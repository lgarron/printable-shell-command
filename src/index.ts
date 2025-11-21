import type {
  ChildProcessByStdio,
  ChildProcess as NodeChildProcess,
  SpawnOptions as NodeSpawnOptions,
} from "node:child_process";
import { stderr } from "node:process";
import { Readable, Writable } from "node:stream";
import type { WriteStream } from "node:tty";
import { styleText } from "node:util";
import type {
  SpawnOptions as BunSpawnOptions,
  Subprocess as BunSubprocess,
  SpawnOptions,
} from "bun";
import { Path, stringifyIfPath } from "path-class";
import type { SetFieldType } from "type-fest";
import type { NodeCwd, NodeWithCwd, spawnType, WithSuccess } from "./spawn";

// TODO: does this import work?
/**
 * @import { stdout } from "node:process"
 */

const DEFAULT_MAIN_INDENTATION = "";
const DEFAULT_ARG_INDENTATION = "  ";
const DEFAULT_ARGUMENT_LINE_WRAPPING = "by-entry";

const INLINE_SEPARATOR = " ";
const LINE_WRAP_LINE_END = " \\\n";

type StyleTextFormat = Parameters<typeof styleText>[0];

const TTY_AUTO_STYLE: StyleTextFormat = ["gray", "bold"];

// biome-ignore lint/suspicious/noExplicitAny: This is the correct type nere.
function isString(s: any): s is string {
  return typeof s === "string";
}

// biome-ignore lint/suspicious/noExplicitAny: This is the correct type here.
function isValidArgsEntryArray(entries: any[]): entries is SingleArgument[] {
  for (const entry of entries) {
    if (isString(entry)) {
      continue;
    }
    if (entry instanceof Path) {
      continue;
    }
    return false;
  }
  return true;
}

// TODO: allow `.toString()`ables?
type SingleArgument = string | Path;
type ArgsEntry = SingleArgument | SingleArgument[];
type Args = ArgsEntry[];

export interface PrintOptions {
  /** Defaults to "" */
  mainIndentation?: string;
  /** Defaults to "  " */
  argIndentation?: string;
  /**
   * - `"auto"`: Quote only arguments that need it for safety. This tries to be
   *   portable and safe across shells, but true safety and portability is hard
   *   to guarantee.
   * - `"extra-safe"`: Quote all arguments, even ones that don't need it. This is
   *   more likely to be safe under all circumstances.
   */
  quoting?: "auto" | "extra-safe";
  /** Line wrapping to use between arguments. Defaults to `"by-entry"`. */
  argumentLineWrapping?:
    | "by-entry"
    | "nested-by-entry"
    | "by-argument"
    | "inline";
  /** Include the first arg (or first arg group) on the same line as the command, regardless of the `argumentLineWrapping` setting. */
  skipLineWrapBeforeFirstArg?: true | false;
  /**
   * Style text using `node`'s {@link styleText | `styleText(…)`}.
   *
   * Example usage:
   *
   * ```
   * new PrintableShellCommand("echo", ["hi"]).print({
   *   styleTextFormat: ["green", "underline"],
   * });
   * */
  styleTextFormat?: StyleTextFormat;
}

export interface StreamPrintOptions extends PrintOptions {
  /**
   * Auto-style the text when:
   *
   * - the output stream is detected to be a TTY
   * - `styleTextFormat` is not specified.
   *
   * The current auto style is: `["gray", "bold"]`
   */
  autoStyle?: "tty" | "never";
  // This would be a `WritableStream` (open web standard), but `WriteStream` allows us to query `.isTTY`.
  stream?: WriteStream | Writable;
}

// https://mywiki.wooledge.org/BashGuide/SpecialCharacters
const SPECIAL_SHELL_CHARACTERS = new Set([
  " ",
  '"',
  "'",
  "`",
  "|",
  "$",
  "*",
  "?",
  ">",
  "<",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "&",
  "\\",
  ";",
  "#",
]);

// https://mywiki.wooledge.org/BashGuide/SpecialCharacters
const SPECIAL_SHELL_CHARACTERS_FOR_MAIN_COMMAND =
  // biome-ignore lint/suspicious/noExplicitAny: Workaround to make this package easier to use in a project that otherwise only uses ES2022.)
  (SPECIAL_SHELL_CHARACTERS as unknown as any).union(new Set(["="]));

// biome-ignore lint/suspicious/noExplicitAny: Just matching
type BunCwd = SpawnOptions.OptionsObject<any, any, any>["cwd"] | Path;
type BunWithCwd<
  // biome-ignore lint/suspicious/noExplicitAny: Just matching
  T extends { cwd?: SpawnOptions.OptionsObject<any, any, any>["cwd"] | Path },
> = SetFieldType<T, "cwd", BunCwd | undefined>;

export class PrintableShellCommand {
  #commandName: string | Path;
  constructor(
    commandName: string | Path,
    private args: Args = [],
  ) {
    if (!isString(commandName) && !(commandName instanceof Path)) {
      // biome-ignore lint/suspicious/noExplicitAny: We want to print this, no matter what it is.
      throw new Error("Command name is not a string:", commandName as any);
    }
    this.#commandName = commandName;
    if (typeof args === "undefined") {
      return;
    }
    if (!Array.isArray(args)) {
      throw new Error("Command arguments are not an array");
    }
    for (let i = 0; i < args.length; i++) {
      const argEntry = args[i];
      if (typeof argEntry === "string") {
        continue;
      }
      if (argEntry instanceof Path) {
        continue;
      }
      if (Array.isArray(argEntry) && isValidArgsEntryArray(argEntry)) {
        continue;
      }
      throw new Error(`Invalid arg entry at index: ${i}`);
    }
  }

  get commandName(): string {
    return stringifyIfPath(this.#commandName);
  }

  /** For use with `bun`.
   *
   * Usage example:
   *
   * ```
   * import { PrintableShellCommand } from "printable-shell-command";
   * import { spawn } from "bun";
   *
   * const command = new PrintableShellCommand( … );
   * await spawn(command.toFlatCommand()).exited;
   * ```
   */
  public toFlatCommand(): string[] {
    return [this.commandName, ...this.args.flat().map(stringifyIfPath)];
  }

  /**
   * Convenient alias for {@link PrintableShellCommand.toFlatCommand | `.toFlatCommand()`}.
   *
   * Usage example:
   *
   * ```
   * import { PrintableShellCommand } from "printable-shell-command";
   * import { spawn } from "bun";
   *
   * const command = new PrintableShellCommand( … );
   * await spawn(command.forBun()).exited;
   * ```
   *
   * */
  public forBun(): string[] {
    return this.toFlatCommand();
  }

  /**
   * For use with `node:child_process`
   *
   * Usage example:
   *
   * ```
   * import { PrintableShellCommand } from "printable-shell-command";
   * import { spawn } from "node:child_process";
   *
   * const command = new PrintableShellCommand( … );
   * const child_process = spawn(...command.toCommandWithFlatArgs()); // Note the `...`
   * ```
   *
   */
  public toCommandWithFlatArgs(): [string, string[]] {
    return [this.commandName, this.args.flat().map(stringifyIfPath)];
  }

  /**
   * For use with `node:child_process`
   *
   * Usage example:
   *
   * ```
   * import { PrintableShellCommand } from "printable-shell-command";
   * import { spawn } from "node:child_process";
   *
   * const command = new PrintableShellCommand( … );
   * const child_process = spawn(...command.forNode()); // Note the `...`
   * ```
   *
   * Convenient alias for {@link PrintableShellCommand.toCommandWithFlatArgs | `toCommandWithFlatArgs()`}.
   */
  public forNode(): [string, string[]] {
    return this.toCommandWithFlatArgs();
  }

  #escapeArg(
    arg: string,
    isMainCommand: boolean,
    options: PrintOptions,
  ): string {
    const argCharacters = new Set(arg);
    const specialShellCharacters = isMainCommand
      ? SPECIAL_SHELL_CHARACTERS_FOR_MAIN_COMMAND
      : SPECIAL_SHELL_CHARACTERS;
    if (
      options?.quoting === "extra-safe" ||
      // biome-ignore lint/suspicious/noExplicitAny: Workaround to make this package easier to use in a project that otherwise only uses ES2022.)
      (argCharacters as unknown as any).intersection(specialShellCharacters)
        .size > 0
    ) {
      // Use single quote to reduce the need to escape (and therefore reduce the chance for bugs/security issues).
      const escaped = arg.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
      return `'${escaped}'`;
    }
    return arg;
  }

  #mainIndentation(options: PrintOptions): string {
    return options?.mainIndentation ?? DEFAULT_MAIN_INDENTATION;
  }

  #argIndentation(options: PrintOptions): string {
    return (
      this.#mainIndentation(options) +
      (options?.argIndentation ?? DEFAULT_ARG_INDENTATION)
    );
  }

  #lineWrapSeparator(options: PrintOptions): string {
    return LINE_WRAP_LINE_END + this.#argIndentation(options);
  }

  #argPairSeparator(options: PrintOptions): string {
    switch (options?.argumentLineWrapping ?? DEFAULT_ARGUMENT_LINE_WRAPPING) {
      case "by-entry": {
        return INLINE_SEPARATOR;
      }
      case "nested-by-entry": {
        return this.#lineWrapSeparator(options) + this.#argIndentation(options);
      }
      case "by-argument": {
        return this.#lineWrapSeparator(options);
      }
      case "inline": {
        return INLINE_SEPARATOR;
      }
      default:
        throw new Error("Invalid argument line wrapping argument.");
    }
  }

  #intraEntrySeparator(options: PrintOptions): string {
    switch (options?.argumentLineWrapping ?? DEFAULT_ARGUMENT_LINE_WRAPPING) {
      case "by-entry":
      case "nested-by-entry":
      case "by-argument": {
        return LINE_WRAP_LINE_END + this.#argIndentation(options);
      }
      case "inline": {
        return INLINE_SEPARATOR;
      }
      default:
        throw new Error("Invalid argument line wrapping argument.");
    }
  }

  #separatorAfterCommand(
    options: PrintOptions,
    numFollowingEntries: number,
  ): string {
    if (numFollowingEntries === 0) {
      return "";
    }
    if (options.skipLineWrapBeforeFirstArg ?? false) {
      return INLINE_SEPARATOR;
    }
    return this.#intraEntrySeparator(options);
  }

  public getPrintableCommand(options?: PrintOptions): string {
    // TODO: Why in the world does TypeScript not give the `options` arg the type of `PrintOptions | undefined`???
    options ??= {};
    const serializedEntries: string[] = [];

    for (let i = 0; i < this.args.length; i++) {
      const argsEntry = stringifyIfPath(this.args[i]);

      if (isString(argsEntry)) {
        serializedEntries.push(this.#escapeArg(argsEntry, false, options));
      } else {
        serializedEntries.push(
          argsEntry
            .map((part) =>
              this.#escapeArg(stringifyIfPath(part), false, options),
            )
            .join(this.#argPairSeparator(options)),
        );
      }
    }

    let text =
      this.#mainIndentation(options) +
      this.#escapeArg(this.commandName, true, options) +
      this.#separatorAfterCommand(options, serializedEntries.length) +
      serializedEntries.join(this.#intraEntrySeparator(options));
    if (options?.styleTextFormat) {
      text = styleText(options.styleTextFormat, text);
    }
    return text;
  }

  /**
   * Print the shell command to {@link stderr} (default) or a specified stream.
   *
   * By default, this will be auto-styled (as bold gray) when `.isTTY` is true
   * for the stream. `.isTTY` is populated for the {@link stderr} and
   * {@link stdout} objects. Pass `"autoStyle": "never"` or an explicit
   * `styleTextFormat` to disable this.
   *
   */
  public print(options?: StreamPrintOptions): PrintableShellCommand {
    const stream = options?.stream ?? stderr;
    // Note: we only need to modify top-level fields, so `structuredClone(…)`
    // would be overkill and can only cause performance issues.
    const optionsCopy = { ...options };
    optionsCopy.styleTextFormat ??=
      options?.autoStyle !== "never" &&
      (stream as { isTTY?: boolean }).isTTY === true
        ? TTY_AUTO_STYLE
        : undefined;
    const writable =
      stream instanceof Writable ? stream : Writable.fromWeb(stream);
    writable.write(this.getPrintableCommand(optionsCopy));
    writable.write("\n");
    return this;
  }

  /**
   * The returned child process includes a `.success` `Promise` field, per https://github.com/oven-sh/bun/issues/8313
   */
  /** @ts-expect-error Type wrangling. */
  public spawn: typeof spawnType = (options?: SpawnOptions & NodeCwd) => {
    const { spawn } = process.getBuiltinModule("node:child_process");
    const cwd = stringifyIfPath(options?.cwd);
    // biome-ignore lint/suspicious/noTsIgnore: We don't want linting to depend on *broken* type checking.
    // @ts-ignore: The TypeScript checker has trouble reconciling the optional (i.e. potentially `undefined`) `options` with the third argument.
    const subprocess = spawn(...this.forNode(), {
      ...(options as object),
      cwd,
    }) as NodeChildProcess & {
      success: Promise<void>;
    };
    Object.defineProperty(subprocess, "success", {
      get() {
        return new Promise<void>((resolve, reject) =>
          this.addListener(
            "exit",
            (exitCode: number /* we only use the first arg */) => {
              if (exitCode === 0) {
                resolve();
              } else {
                reject(`Command failed with non-zero exit code: ${exitCode}`);
              }
            },
          ),
        );
      },
      enumerable: false,
    });
    return subprocess;
  };

  /** A wrapper for `.spawn(…)` that sets stdio to `"inherit"` (common for
   * invoking commands from scripts whose output and interaction should be
   * surfaced to the user).
   *
   * If there is no other interaction with the shell from the calling process,
   * then it acts "transparent" and allows user to interact with the subprocess
   * in its stead.
   */
  public spawnTransparently(
    options?: NodeWithCwd<Omit<NodeSpawnOptions, "stdio">>,
  ): ChildProcessByStdio<null, null, null> & WithSuccess {
    if (options && "stdio" in options) {
      throw new Error("Unexpected `stdio` field.");
    }

    // biome-ignore lint/suspicious/noExplicitAny: Type wrangling.
    return this.spawn({ ...options, stdio: "inherit" }) as any;
  }

  /** @deprecated: Use `.spawnTransparently(…)`. */
  public spawnInherit(
    options?: NodeWithCwd<Omit<NodeSpawnOptions, "stdio">>,
  ): NodeChildProcess & WithSuccess {
    return this.spawnTransparently(options);
  }

  /**
   * A wrapper for {@link PrintableShellCommand.spawn | `.spawn(…)`} that:
   *
   * - sets `detached` to `true`,
   * - sets stdio to `"inherit"`,
   * - calls `.unref()`, and
   * - does not wait for the process to exit.
   *
   * This is similar to starting a command int he background and disowning it (in a shell).
   *
   * The `stdio` field is left overridable. To capture `stdout` and `stderr`, connect them to output files like this:
   *
   * ```
   * import { open } from "node:fs/promises";
   * import { Path } from "path-class";
   * import { PrintableShellCommand } from "printable-shell-command";
   *
   * const tempDir = await Path.makeTempDir();
   * console.log(`Temp dir: ${tempDir}`);
   * const stdout = await open(tempDir.join("stdout.log").path, "a");
   * const stderr = await open(tempDir.join("stderr.log").path, "a");
   *
   * new PrintableShellCommand("echo", ["hi"]).spawnDetached({
   *   stdio: ["ignore", stdout.fd, stderr.fd],
   * });
   * ```
   *
   */
  public spawnDetached(
    options?: NodeWithCwd<Omit<NodeSpawnOptions, "detached">>,
  ): void {
    if (options && "detached" in options) {
      throw new Error("Unexpected `detached` field.");
    }
    const childProcess = this.spawn({
      stdio: "ignore",
      ...options,
      detached: true,
    });
    childProcess.unref();
  }

  public stdout(
    options?: NodeWithCwd<Omit<NodeSpawnOptions, "stdio">>,
  ): Response {
    if (options && "stdio" in options) {
      throw new Error("Unexpected `stdio` field.");
    }
    const subprocess = this.spawn({
      ...options,
      stdio: ["ignore", "pipe", "inherit"],
    });

    return new Response(Readable.toWeb(subprocess.stdout));
  }

  /**
   * Convenience function for:
   *
   *     .stdout(options).text()
   *
   * This can make some simple invocations easier to read and/or fit on a single line.
   */
  public text(
    options?: NodeWithCwd<Omit<NodeSpawnOptions, "stdio">>,
  ): Promise<string> {
    return this.stdout(options).text();
  }

  /**
   * Convenience function for:
   *
   *     .stdout(options).json()
   *
   * This can make some simple invocations easier to read and/or fit on a single line.
   */
  public json<T>(
    options?: NodeWithCwd<Omit<NodeSpawnOptions, "stdio">>,
  ): Promise<T> {
    return this.stdout(options).json() as Promise<T>;
  }

  /** Equivalent to:
   *
   * ```
   * await this.print().spawnTransparently(…).success;
   * ```
   */
  public async shellOut(
    options?: NodeWithCwd<Omit<NodeSpawnOptions, "stdio">>,
  ): Promise<void> {
    await this.print().spawnTransparently(options).success;
  }

  /**
   * The returned subprocess includes a `.success` `Promise` field, per https://github.com/oven-sh/bun/issues/8313
   */
  #spawnBun<
    const In extends BunSpawnOptions.Writable = "ignore",
    const Out extends BunSpawnOptions.Readable = "pipe",
    const Err extends BunSpawnOptions.Readable = "inherit",
  >(
    options?: BunWithCwd<
      Omit<BunSpawnOptions.OptionsObject<In, Out, Err>, "cmd">
    >,
  ): BunSubprocess<In, Out, Err> & { success: Promise<void> } {
    if (options && "cmd" in options) {
      throw new Error("Unexpected `cmd` field.");
    }
    const { spawn } = process.getBuiltinModule("bun") as typeof import("bun");
    const cwd = stringifyIfPath(options?.cwd);
    const subprocess = spawn({
      ...options,
      cwd,
      cmd: this.forBun(),
    }) as BunSubprocess<In, Out, Err> & { success: Promise<void> };
    Object.defineProperty(subprocess, "success", {
      get() {
        return new Promise<void>((resolve, reject) =>
          this.exited
            .then((exitCode: number) => {
              if (exitCode === 0) {
                resolve();
              } else {
                reject(
                  new Error(
                    `Command failed with non-zero exit code: ${exitCode}`,
                  ),
                );
              }
            })
            .catch(reject),
        );
      },
      enumerable: false,
    });
    return subprocess;
  }

  #spawnBunInherit(
    options?: BunWithCwd<
      Omit<
        BunSpawnOptions.OptionsObject<"inherit", "inherit", "inherit">,
        "cmd" | "stdio"
      >
    >,
  ): BunSubprocess<"inherit", "inherit", "inherit"> & {
    success: Promise<void>;
  } {
    if (options && "stdio" in options) {
      throw new Error("Unexpected `stdio` field.");
    }
    return this.bun.spawnBun({
      ...options,
      stdio: ["inherit", "inherit", "inherit"],
    });
  }

  #spawnBunStdout(
    options?: BunWithCwd<
      Omit<
        BunSpawnOptions.OptionsObject<"inherit", "inherit", "inherit">,
        "cmd" | "stdio"
      >
    >,
  ): Response {
    // biome-ignore lint/suspicious/noExplicitAny: Avoid breaking the lib check when used without `@types/bun`.
    return new Response((this.bun.spawnBun(options) as any).stdout);
  }

  async #shellOutBun(
    options?: BunWithCwd<
      Omit<
        BunSpawnOptions.OptionsObject<"inherit", "inherit", "inherit">,
        "cmd" | "stdio"
      >
    >,
  ): Promise<void> {
    await this.print().bun.spawnBunInherit(options).success;
  }

  bun = {
    /** Equivalent to:
     *
     * ```
     * await this.print().bun.spawnBunInherit(…).success;
     * ```
     */
    spawnBun: this.#spawnBun.bind(this),
    /**
     * A wrapper for `.spawnBunInherit(…)` that sets stdio to `"inherit"` (common
     * for invoking commands from scripts whose output and interaction should be
     * surfaced to the user).
     */
    spawnBunInherit: this.#spawnBunInherit.bind(this),
    /** Equivalent to:
     *
     * ```
     * new Response(this.bun.spawnBun(…).stdout);
     * ```
     */
    spawnBunStdout: this.#spawnBunStdout.bind(this),
    shellOutBun: this.#shellOutBun.bind(this),
  };
}

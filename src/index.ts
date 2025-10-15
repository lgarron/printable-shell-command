import type {
  ChildProcess as NodeChildProcess,
  SpawnOptions as NodeSpawnOptions,
  SpawnOptionsWithoutStdio as NodeSpawnOptionsWithoutStdio,
  SpawnOptionsWithStdioTuple as NodeSpawnOptionsWithStdioTuple,
  StdioNull as NodeStdioNull,
  StdioPipe as NodeStdioPipe,
} from "node:child_process";
import { Readable } from "node:stream";
import { styleText } from "node:util";
import type {
  SpawnOptions as BunSpawnOptions,
  Subprocess as BunSubprocess,
} from "bun";

const DEFAULT_MAIN_INDENTATION = "";
const DEFAULT_ARG_INDENTATION = "  ";
const DEFAULT_ARGUMENT_LINE_WRAPPING = "by-entry";

const INLINE_SEPARATOR = " ";
const LINE_WRAP_LINE_END = " \\\n";

// biome-ignore lint/suspicious/noExplicitAny: This is the correct type nere.
function isString(s: any): s is string {
  return typeof s === "string";
}
// biome-ignore lint/suspicious/noExplicitAny: This is the correct type nere.
function isStringArray(entries: any[]): entries is string[] {
  for (const entry of entries) {
    if (!isString(entry)) {
      return false;
    }
  }
  return true;
}

// TODO: allow `.toString()`ables?
type SingleArgument = string;
type FlagArgumentGroup = string[];
type ArgsEntry = SingleArgument | FlagArgumentGroup;
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
   * Style text using `node`'s [`styleText(…)`](https://nodejs.org/api/util.html#utilstyletextformat-text-options)
   *
   * Example usage:
   *
   * ```
   * new PrintableShellCommand("echo", ["hi"]).print({
   *   styleTextFormat: ["gray", "bold"],
   * });
   * */
  styleTextFormat?: Parameters<typeof styleText>[0];
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

export class PrintableShellCommand {
  #commandName: string;
  constructor(
    commandName: string,
    private args: Args = [],
  ) {
    if (!isString(commandName)) {
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
      if (Array.isArray(argEntry) && isStringArray(argEntry)) {
        continue;
      }
      throw new Error(`Invalid arg entry at index: ${i}`);
    }
  }

  get commandName(): string {
    return this.#commandName;
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
    return [this.commandName, ...this.args.flat()];
  }

  /**
   * Convenient alias for `toFlatCommand()`.
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
    return [this.commandName, this.args.flat()];
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
   * Convenient alias for `toCommandWithFlatArgs()`.
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
      const argsEntry = this.args[i];

      if (isString(argsEntry)) {
        serializedEntries.push(this.#escapeArg(argsEntry, false, options));
      } else {
        serializedEntries.push(
          argsEntry
            .map((part) => this.#escapeArg(part, false, options))
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

  public print(options?: PrintOptions): PrintableShellCommand {
    console.log(this.getPrintableCommand(options));
    return this;
  }

  /**
   * The returned child process includes a `.success` `Promise` field, per https://github.com/oven-sh/bun/issues/8313
   */
  public spawn<
    Stdin extends NodeStdioNull | NodeStdioPipe,
    Stdout extends NodeStdioNull | NodeStdioPipe,
    Stderr extends NodeStdioNull | NodeStdioPipe,
  >(
    options?:
      | NodeSpawnOptions
      | NodeSpawnOptionsWithoutStdio
      | NodeSpawnOptionsWithStdioTuple<Stdin, Stdout, Stderr>,
  ): // TODO: figure out how to return `ChildProcessByStdio<…>` without duplicating fragile boilerplate.
  NodeChildProcess & { success: Promise<void> } {
    const { spawn } = process.getBuiltinModule("node:child_process");
    // biome-ignore lint/suspicious/noTsIgnore: We don't want linting to depend on *broken* type checking.
    // @ts-ignore: The TypeScript checker has trouble reconciling the optional (i.e. potentially `undefined`) `options` with the third argument.
    const subprocess = spawn(...this.forNode(), options) as NodeChildProcess & {
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
  }

  /** A wrapper for `.spawnNode(…)` that sets stdio to `"inherit"` (common for
   * invoking commands from scripts whose output and interaction should be
   * surfaced to the user). */
  public spawnInherit(
    options?: Omit<NodeSpawnOptions, "stdio">,
  ): NodeChildProcess & { success: Promise<void> } {
    if (options && "stdio" in options) {
      throw new Error("Unexpected `stdio` field.");
    }
    return this.spawn({ ...options, stdio: "inherit" });
  }

  public stdout(options?: Omit<NodeSpawnOptions, "stdio">): Response {
    if (options && "stdio" in options) {
      throw new Error("Unexpected `stdio` field.");
    }
    const subprocess = this.spawn({
      ...options,
      stdio: ["ignore", "pipe", "inherit"],
    });

    // biome-ignore lint/style/noNonNullAssertion: dude
    return new Response(Readable.toWeb(subprocess.stdout!));
  }

  /** Equivalent to:
   *
   * ```
   * await this.print().spawnInherit(…).success;
   * ```
   */
  public async shellOut(
    options?: Omit<NodeSpawnOptions, "stdio">,
  ): Promise<void> {
    await this.print().spawnInherit(options).success;
  }

  /**
   * The returned subprocess includes a `.success` `Promise` field, per https://github.com/oven-sh/bun/issues/8313
   */
  #spawnBun<
    const In extends BunSpawnOptions.Writable = "ignore",
    const Out extends BunSpawnOptions.Readable = "pipe",
    const Err extends BunSpawnOptions.Readable = "inherit",
  >(
    options?: Omit<BunSpawnOptions.OptionsObject<In, Out, Err>, "cmd">,
  ): BunSubprocess<In, Out, Err> & { success: Promise<void> } {
    if (options && "cmd" in options) {
      throw new Error("Unexpected `cmd` field.");
    }
    const { spawn } = process.getBuiltinModule("bun") as typeof import("bun");
    const subprocess = spawn({
      ...options,
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
    options?: Omit<
      Omit<
        BunSpawnOptions.OptionsObject<"inherit", "inherit", "inherit">,
        "cmd"
      >,
      "stdio"
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
    options?: Omit<
      Omit<
        BunSpawnOptions.OptionsObject<"inherit", "inherit", "inherit">,
        "cmd"
      >,
      "stdio"
    >,
  ): Response {
    // biome-ignore lint/suspicious/noExplicitAny: Avoid breaking the lib check when used without `@types/bun`.
    return new Response((this.bun.spawnBun(options) as any).stdout);
  }

  async #shellOutBun(
    options?: Omit<
      Omit<
        BunSpawnOptions.OptionsObject<"inherit", "inherit", "inherit">,
        "cmd"
      >,
      "stdio"
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

const INLINE_SEPARATOR = " ";
const LINE_WRAP_SEPARATOR = " \\\n  ";

// biome-ignore lint/suspicious/noExplicitAny: This is the correct type nere.
function isString(s: any): s is string {
	return typeof s === "string";
}

// TODO: allow `.toString()`ables?
type SingleArgument = string;
type FlagArgumentPair = [string, string];
type ArgsEntry = SingleArgument | FlagArgumentPair;
type Args = ArgsEntry[];

export interface PrintOptions {
	mainIndentation?: string; // Defaults to ""
	argIndentation?: string; // Defaults to "  "
	// - "auto": Quote only arguments that need it for safety. This tries to be
	//   portable and safe across shells, but true safety and portability is hard
	//   to guarantee.
	// - "extra-safe": Quote all arguments, even ones that don't need it. This is
	//   more likely to be safe under all circumstances.
	quoting?: "auto" | "extra-safe";
	lineWrap?: "none" | "by-entry";
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
]);

// https://mywiki.wooledge.org/BashGuide/SpecialCharacters
const SPECIAL_SHELL_CHARACTERS_FOR_MAIN_COMMAND =
	SPECIAL_SHELL_CHARACTERS.union(new Set(["="]));

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
			if (
				Array.isArray(argEntry) &&
				argEntry.length === 2 &&
				isString(argEntry[0]) &&
				isString(argEntry[1])
			) {
				continue;
			}
			throw new Error(`Invalid arg entry at index: ${i}`);
		}
	}

	get commandName(): string {
		return this.#commandName;
	}

	// For use with `bun`.
	//
	// Usage example:
	//
	//     import { PrintableShellCommand } from "printable-shell-command";
	//     import { spawn } from "bun";
	//
	//     const command = new PrintableShellCommand(/* … */);
	//     await spawn(command.toFlatCommand()).exited;
	//
	public toFlatCommand(): string[] {
		return [this.commandName, ...this.args.flat()];
	}

	// Convenient alias for `toFlatCommand()`.
	//
	// Usage example:
	//
	//     import { PrintableShellCommand } from "printable-shell-command";
	//     import { spawn } from "bun";
	//
	//     const command = new PrintableShellCommand(/* … */);
	//     await spawn(command.forBun()).exited;
	//
	public forBun(): string[] {
		return this.toFlatCommand();
	}

	// For use with `node:child_process`
	//
	// Usage example:
	//
	//     import { PrintableShellCommand } from "printable-shell-command";
	//    import { spawn } from "node:child_process";
	//
	//    const command = new PrintableShellCommand(/* … */);
	//    const child_process = spawn(...command.toCommandWithFlatArgs()); // Note the `...`
	//
	public toCommandWithFlatArgs(): [string, string[]] {
		return [this.commandName, this.args.flat()];
	}

	// For use with `node:child_process`
	//
	// Usage example:
	//
	//     import { PrintableShellCommand } from "printable-shell-command";
	//    import { spawn } from "node:child_process";
	//
	//    const command = new PrintableShellCommand(/* … */);
	//    const child_process = spawn(...command.forNode()); // Note the `...`
	//
	// Convenient alias for `toCommandWithFlatArgs()`.
	public forNode(): [string, string[]] {
		return this.toCommandWithFlatArgs();
	}

	#escapeArg(
		arg: string,
		isMainCommand: boolean,
		options?: PrintOptions,
	): string {
		const argCharacters = new Set(arg);
		const specialShellCharacters = isMainCommand
			? SPECIAL_SHELL_CHARACTERS_FOR_MAIN_COMMAND
			: SPECIAL_SHELL_CHARACTERS;
		if (
			options?.quoting === "extra-safe" ||
			argCharacters.intersection(specialShellCharacters).size > 0
		) {
			// Use single quote to reduce the need to escape (and therefore reduce the chance for bugs/security issues).
			const escaped = arg.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
			return `'${escaped}'`;
		}
		return arg;
	}

	#smallIndent(s: string, options?: PrintOptions): string {
		return (options?.mainIndentation ?? "") + s;
	}

	#bigIndent(s: string, options?: PrintOptions): string {
		return this.#smallIndent((options?.argIndentation ?? "  ") + s, options);
	}

	public getPrintableCommand(options?: PrintOptions): string {
		const lines: string[] = [];

		lines.push(
			this.#smallIndent(
				this.#escapeArg(this.commandName, true, options),
				options,
			),
		);

		// let pendingNewlineAfterPart = options?.separateLines === "dash-heuristic";
		for (let i = 0; i < this.args.length; i++) {
			const argsEntry = this.args[i];

			if (isString(argsEntry)) {
				lines.push(
					this.#bigIndent(this.#escapeArg(argsEntry, false, options), options),
				);
			} else {
				const [part1, part2] = argsEntry;

				lines.push(
					this.#bigIndent(
						this.#escapeArg(part1, false, options) +
							INLINE_SEPARATOR +
							this.#escapeArg(part2, false, options),
						options,
					),
				);
			}
		}
		return lines.join(LINE_WRAP_SEPARATOR);
	}

	public print(options?: PrintOptions): void {
		console.log(this.getPrintableCommand(options));
	}
}

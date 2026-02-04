# `printable-shell-command`

A helper class to construct shell commands in a way that allows printing them.

The goal is to make it easy to print commands that are being run by a program, in a way that makes it easy and safe for a user to copy-and-paste.

## Goals

1. Security — the printed commands should be possible to use in all shells without injection vulnerabilities.
2. Fidelity — the printed command must match the arguments provided.
3. Aesthetics — the command is pretty-printed to make it easy to read and to avoid escaping/quoting simple arguments where humans usually would not.

Point 1 is difficult, and maybe even impossible. This library will do its best, but what you don't know can hurt you.

## Usage

Construct a command by providing a command string and a list of argument entries. Each entry can either be an individual string, or a tuple containing two or more strings (usually a command flag and its argument). Grouping arguments into tuples controls pretty-printing, but does not affect the semantics of the command.

```typescript
// example.ts
import { PrintableShellCommand } from "printable-shell-command";

export const command = new PrintableShellCommand("ffmpeg", [
  ["-i", "./test/My video.mp4"],
  ["-filter:v", "setpts=2.0*PTS"],
  ["-filter:a", "atempo=0.5"],
  "./test/My video (slow-mo).mov",
]);

command.print();
```

This prints:

```shell
ffmpeg \
  -i './test/My video.mp4' \
  -filter:v 'setpts=2.0*PTS' \
  -filter:a atempo=0.5 \
  './test/My video (slow-mo).mov'
```

### Spawn a process in `node`

````ts example
import { spawn } from "node:child_process";
import { PrintableShellCommand } from "printable-shell-command";

const command = new PrintableShellCommand("ffmpeg", [
  ["-i", "./test/My video.mp4"],
  ["-filter:v", "setpts=2.0*PTS"],
  ["-filter:a", "atempo=0.5"],
  "./test/My video (slow-mo).mov",
]);

command.shellOut();

// Spawn directly
await command.spawn().success;
await command.spawnTransparently().success;
command.spawnDetached();

// Or use `node` spawn (note the `...`).
spawn(...command.toCommandWithFlatArgs(), {});
````

## Protections

Any command or argument containing the following characters is quoted and escaped:

- <code> </code> (space character)
- `"` (double quote)
- `'` (single quote)
- <code>`</code> (backtick)
- `|`
- `$`
- `*`
- `?`
- `>`
- `<`
- `(`
- `)`
- `[`
- `]`
- `{`
- `}`
- `&`
- `\`
- `;`
- `#`

Additionally, a command is escaped if it contains an `=`.

Escaping is done as follows:

- The command is single-quoted.
- Backslashes and single quotes are escaped.

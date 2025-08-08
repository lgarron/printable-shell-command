/** biome-ignore-all lint/correctness/noUnusedVariables: This is an example. */

import { spawn } from "node:child_process";
import { PrintableShellCommand } from "printable-shell-command";

const command = new PrintableShellCommand("ffmpeg", [
  ["-i", "./test/My video.mp4"],
  ["-filter:v", "setpts=2.0*PTS"],
  ["-filter:a", "atempo=0.5"],
  "./test/My video (slow-mo).mov",
]);

command.print().shellOutNode();

const child_process = spawn(...command.toCommandWithFlatArgs()); // Note the `...`

// or directly
await command.spawnNode().success;
await command.spawnNodeInherit().success;

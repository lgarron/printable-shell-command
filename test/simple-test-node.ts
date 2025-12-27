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

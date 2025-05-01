import { spawn } from "bun";
import { PrintableShellCommand } from "../src";

const command = new PrintableShellCommand("ffmpeg", [
	["-i", "./test/My video.mp4"],
	["-filter:v", "setpts=2.0*PTS"],
	["-filter:a", "atempo=0.5"],
	"./test/My video (slow-mo).mov",
]);

await command.shellOutBun();
await spawn(command.toFlatCommand()).exited;

// or directly
await command.spawnBun().success;
await command.spawnBunInherit().success;

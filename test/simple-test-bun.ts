import { spawn } from "bun";
import { PrintableShellCommand } from "../src";

const command = new PrintableShellCommand("ffmpeg", [
	["-i", "./test/My video.mp4"],
	["-filter:v", "setpts=2.0*PTS"],
	["-filter:a", "atempo=0.5"],
	"./test/My video (slow-mo).mov",
]);

command.print();
await spawn({ cmd: command.toFlatCommand() }).exited;

import { PrintableShellCommand } from "../src";

const command = new PrintableShellCommand("ffmpeg", [
	["-i", "./test/My video.mp4"],
	["-filter:v", "setpts=2.0*PTS"],
	["-filter:a", "atempo=0.5"],
	"./test/My video (slow-mo).mov",
]);

command.print();

// Note that `ffmpeg` still returns successfully even if the user responds "no" to the overwrite prompt.
command.spawnBun({ stdio: ["inherit", "inherit", "inherit"] });

import { expect, test } from "bun:test";
import { PrintableShellCommand } from "../src";

const rsyncCommand = new PrintableShellCommand("rsync", [
  "-avz",
  ["--exclude", ".DS_Store"],
  ["--exclude", ".git"],
  "./dist/web/experiments.cubing.net/test/deploy/",
  "experiments.cubing.net:~/experiments.cubing.net/test/deploy/",
]);

test("args for commands", () => {
  expect(rsyncCommand.toCommandWithFlatArgs()).toEqual([
    "rsync",
    [
      "-avz",
      "--exclude",
      ".DS_Store",
      "--exclude",
      ".git",
      "./dist/web/experiments.cubing.net/test/deploy/",
      "experiments.cubing.net:~/experiments.cubing.net/test/deploy/",
    ],
  ]);
  expect(rsyncCommand.toFlatCommand()).toEqual([
    "rsync",
    "-avz",
    "--exclude",
    ".DS_Store",
    "--exclude",
    ".git",
    "./dist/web/experiments.cubing.net/test/deploy/",
    "experiments.cubing.net:~/experiments.cubing.net/test/deploy/",
  ]);
  expect(rsyncCommand.toCommandWithFlatArgs()).toEqual(rsyncCommand.forNode());
  expect(rsyncCommand.toFlatCommand()).toEqual(rsyncCommand.forBun());
});

test("default formatting", () => {
  expect(rsyncCommand.getPrintableCommand()).toEqual(
    `rsync \\
  -avz \\
  --exclude .DS_Store \\
  --exclude .git \\
  ./dist/web/experiments.cubing.net/test/deploy/ \\
  experiments.cubing.net:~/experiments.cubing.net/test/deploy/`,
  );
  expect(
    rsyncCommand.getPrintableCommand({
      quoting: "auto",
      argumentLineWrapping: "by-entry",
    }),
  ).toEqual(rsyncCommand.getPrintableCommand());
});

test("extra-safe quoting", () => {
  expect(rsyncCommand.getPrintableCommand({ quoting: "extra-safe" })).toEqual(
    `'rsync' \\
  '-avz' \\
  '--exclude' '.DS_Store' \\
  '--exclude' '.git' \\
  './dist/web/experiments.cubing.net/test/deploy/' \\
  'experiments.cubing.net:~/experiments.cubing.net/test/deploy/'`,
  );
});

test("indentation", () => {
  expect(
    rsyncCommand.getPrintableCommand({ argIndentation: "\t   \t" }),
  ).toEqual(
    `rsync \\
	   	-avz \\
	   	--exclude .DS_Store \\
	   	--exclude .git \\
	   	./dist/web/experiments.cubing.net/test/deploy/ \\
	   	experiments.cubing.net:~/experiments.cubing.net/test/deploy/`,
  );
  expect(rsyncCommand.getPrintableCommand({ argIndentation: "↪ " })).toEqual(
    `rsync \\
↪ -avz \\
↪ --exclude .DS_Store \\
↪ --exclude .git \\
↪ ./dist/web/experiments.cubing.net/test/deploy/ \\
↪ experiments.cubing.net:~/experiments.cubing.net/test/deploy/`,
  );
  expect(rsyncCommand.getPrintableCommand({ mainIndentation: "  " })).toEqual(
    `  rsync \\
    -avz \\
    --exclude .DS_Store \\
    --exclude .git \\
    ./dist/web/experiments.cubing.net/test/deploy/ \\
    experiments.cubing.net:~/experiments.cubing.net/test/deploy/`,
  );
  expect(
    rsyncCommand.getPrintableCommand({
      mainIndentation: "🙈",
      argIndentation: "🙉",
    }),
  ).toEqual(
    `🙈rsync \\
🙈🙉-avz \\
🙈🙉--exclude .DS_Store \\
🙈🙉--exclude .git \\
🙈🙉./dist/web/experiments.cubing.net/test/deploy/ \\
🙈🙉experiments.cubing.net:~/experiments.cubing.net/test/deploy/`,
  );
});

test("line wrapping", () => {
  expect(
    rsyncCommand.getPrintableCommand({ argumentLineWrapping: "by-entry" }),
  ).toEqual(rsyncCommand.getPrintableCommand());
  expect(
    rsyncCommand.getPrintableCommand({
      argumentLineWrapping: "nested-by-entry",
    }),
  ).toEqual(`rsync \\
  -avz \\
  --exclude \\
    .DS_Store \\
  --exclude \\
    .git \\
  ./dist/web/experiments.cubing.net/test/deploy/ \\
  experiments.cubing.net:~/experiments.cubing.net/test/deploy/`);
  expect(
    rsyncCommand.getPrintableCommand({ argumentLineWrapping: "by-argument" }),
  ).toEqual(`rsync \\
  -avz \\
  --exclude \\
  .DS_Store \\
  --exclude \\
  .git \\
  ./dist/web/experiments.cubing.net/test/deploy/ \\
  experiments.cubing.net:~/experiments.cubing.net/test/deploy/`);
  expect(
    rsyncCommand.getPrintableCommand({
      argumentLineWrapping: "inline",
    }),
  ).toEqual(
    "rsync -avz --exclude .DS_Store --exclude .git ./dist/web/experiments.cubing.net/test/deploy/ experiments.cubing.net:~/experiments.cubing.net/test/deploy/",
  );
});

test("command with space is escaped by default", () => {
  const command = new PrintableShellCommand(
    "/Applications/My App.app/Contents/Resources/my-app",
  );

  expect(command.getPrintableCommand()).toEqual(
    `'/Applications/My App.app/Contents/Resources/my-app'`,
  );
});

test("command with equal sign is escaped by default", () => {
  const command = new PrintableShellCommand("THIS_LOOKS_LIKE_AN=env-var");

  expect(command.getPrintableCommand()).toEqual(`'THIS_LOOKS_LIKE_AN=env-var'`);
});

test("stylin'", () => {
  expect(
    rsyncCommand.getPrintableCommand({ styleTextFormat: ["gray", "bold"] }),
  ).toEqual(
    `\u001B[90m\u001B[1mrsync \\
  -avz \\
  --exclude .DS_Store \\
  --exclude .git \\
  ./dist/web/experiments.cubing.net/test/deploy/ \\
  experiments.cubing.net:~/experiments.cubing.net/test/deploy/\u001B[22m\u001B[39m`,
  );
});

test("more than 2 args in a group", () => {
  expect(
    new PrintableShellCommand("echo", [
      ["the", "rain", "in", "spain"],
      "stays",
      ["mainly", "in", "the", "plain"],
    ]).getPrintableCommand(),
  ).toEqual(
    `echo \\
  the rain in spain \\
  stays \\
  mainly in the plain`,
  );
});

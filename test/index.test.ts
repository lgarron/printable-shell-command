import { expect, test } from "bun:test";
import { open } from "node:fs/promises";
import { Path } from "path-class";
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

test("don't line wrap after command", () => {
  expect(
    new PrintableShellCommand("echo", [
      ["the", "rain", "in", "spain"],
      "stays",
      ["mainly", "in", "the", "plain"],
    ]).getPrintableCommand({ skipLineWrapBeforeFirstArg: true }),
  ).toEqual(
    `echo the rain in spain \\
  stays \\
  mainly in the plain`,
  );
});

test("don't line wrap after command (when there are no args)", () => {
  expect(
    new PrintableShellCommand("echo", []).getPrintableCommand({
      skipLineWrapBeforeFirstArg: true,
    }),
  ).toEqual(`echo`);
});

test("spawnDetached", async () => {
  const tempDir = await Path.makeTempDir();
  console.log(`Temp dir: ${tempDir}`);
  const stdout = await open(tempDir.join("stdout.log").path, "a");
  const stderr = await open(tempDir.join("stderr.log").path, "a");

  new PrintableShellCommand("echo", ["hi"]).spawnDetached({
    stdio: ["ignore", stdout.fd, stderr.fd],
  });

  // Wait a short while for the command to finish.
  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(await tempDir.join("stdout.log").readText()).toBe("hi\n");
});

test("`Path` commandName", async () => {
  const echoPath = new Path(
    // Note that we need to use `which` instead of `command` here, because the latter binary does not have the same functionality as `command --search` in the shell.
    (await new PrintableShellCommand("which", ["echo"]).stdout().text()).trim(),
  );

  await new PrintableShellCommand(echoPath, [
    "from a `Path` commandName!",
  ]).shellOut();
});

test("`Path` arg (unnested)", async () => {
  const tempDir = await Path.makeTempDir();

  await new PrintableShellCommand("ls", [tempDir]).shellOut();
});

test("`Path` arg (nested)", async () => {
  const tempDir = await Path.makeTempDir();

  await new PrintableShellCommand("ls", [[tempDir]]).shellOut();
});

test("`Path` cwd", async () => {
  const tempDir = await Path.makeTempDir();
  await tempDir.join("foo.txt").write("foo");
  await tempDir.join("bar.txt").write("bar");

  expect(
    await new PrintableShellCommand("ls", [tempDir]).stdout().text(),
  ).toEqual(`bar.txt
foo.txt
`);
});

test(".text()", async () => {
  expect(await new PrintableShellCommand("echo", ["-n", "hi"]).text()).toEqual(
    "hi",
  );
});

test(".json()", async () => {
  expect(
    await new PrintableShellCommand("echo", ["-n", '{ "foo": 4 }']).json<{
      foo: number;
    }>(),
  ).toEqual({ foo: 4 });
});

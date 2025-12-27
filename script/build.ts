import { es2022Lib } from "@cubing/dev-config/esbuild/es2022";
import { build } from "esbuild";
import { PrintableShellCommand } from "../src/PrintableShellCommand";

await build({
  ...es2022Lib(),
  entryPoints: ["src/index.ts"],
  outdir: "./dist/lib/printable-shell-command/",
  sourcemap: true,
});

await new PrintableShellCommand("bun", [
  "x",
  "tsc",
  ["--project", "./tsconfig.build.json"],
]).shellOut();

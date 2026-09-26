import { chmod, writeFile } from "node:fs/promises";
import { build } from "esbuild";

await build({
  entryPoints: ["src/core/cli.ts"],
  outfile: "dist/cli.js",
  bundle: true,
  platform: "neutral",
  format: "esm",
  target: ["node20"],
  conditions: ["default"],
  mainFields: ["browser", "module", "main"],
  external: ["node:*"],
  banner: { js: "#!/usr/bin/env node" },
});

await chmod("dist/cli.js", 0o755);

/**
 * The command reference is generated, because it said it was and was not.
 *
 * Keep the installed command reference aligned with the CLI usage text.
 */
const { USAGE } = await import("../dist/cli.js");
await writeFile(
  "templates/skill/wfctl/references/commands.md",
  [
    "# The command surface",
    "",
    "Generated from the CLI usage text. All record creation is voluntary.",
    "",
    "```",
    USAGE.split("\n").slice(1).join("\n").replace(/^\n+|\n+$/g, ""),
    "```",
    "",
  ].join("\n"),
  "utf8",
);

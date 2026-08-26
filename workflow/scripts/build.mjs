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
 * `references/commands.md` opens with "Generated from the CLI's own usage" and
 * was maintained by hand, so it drifted the moment a command was added — and a
 * reference that claims to be generated is the one nobody thinks to check. It
 * is written from USAGE here, at build time, so the claim is true.
 */
const { USAGE } = await import("../dist/cli.js");
await writeFile(
  "templates/skill/wfctl/references/commands.md",
  [
    "# The command surface",
    "",
    "Generated from the CLI's own usage at build time. You are not expected to",
    "memorise this — each command prints what comes next. Reach for it when you",
    "need exact flags.",
    "",
    "```",
    USAGE.split("\n").slice(1).join("\n").replace(/^\n+|\n+$/g, ""),
    "```",
    "",
  ].join("\n"),
  "utf8",
);

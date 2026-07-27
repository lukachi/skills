import { chmod } from "node:fs/promises";
import { build } from "esbuild";

await build({
  entryPoints: ["src/cli.ts"],
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

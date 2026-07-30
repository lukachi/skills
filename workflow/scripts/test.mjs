import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const tests = readdirSync("tests")
  .filter((entry) => entry.endsWith(".test.ts"))
  .sort()
  .map((entry) => resolve("tests", entry));

for (const test of tests) {
  const result = spawnSync(process.execPath, ["test", test], {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

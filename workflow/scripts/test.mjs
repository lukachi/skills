import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const tests = readdirSync("tests")
  .filter((entry) => entry.endsWith(".test.ts"))
  .sort()
  .map((entry) => resolve("tests", entry));

for (const test of tests) {
  /**
   * The end-to-end suites spawn the built binary once per assertion, so the
   * runner's five-second default measures machine load rather than anything the
   * tool did. Twelve tests failed at exactly 5001ms on a busy laptop and passed
   * alone — a timeout that reads exactly like a real failure, which is the
   * worst thing a suite can report.
   */
  const result = spawnSync(process.execPath, ["test", "--timeout", "120000", test], {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

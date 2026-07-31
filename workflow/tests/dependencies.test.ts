import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  commandFailure,
  compareVersions,
  graphifyCliCheck,
  parseQmdVersion,
  qmdVersionCheck,
  resolveQmdSkillSource,
  type AsyncToolRunner,
  type ToolRunner,
  updateGraphifyGraph,
  updateGraphifyGraphAsync,
} from "../src/dependencies.js";

test("parses and compares supported QMD versions", () => {
  assert.equal(parseQmdVersion("qmd 2.5.3\n"), "2.5.3");
  assert.equal(parseQmdVersion("unexpected"), undefined);
  assert.equal(compareVersions("2.5.3", "2.5.3"), 0);
  assert.equal(compareVersions("2.6.0", "2.5.3"), 1);
  assert.equal(compareVersions("2.5.2", "2.5.3"), -1);
});

test("rejects missing, malformed, and old QMD versions", () => {
  assert.equal(qmdVersionCheck(result(1, "", "missing")).status, "fail");
  assert.equal(qmdVersionCheck(result(0, "unknown", "")).status, "fail");
  assert.equal(qmdVersionCheck(result(0, "qmd 2.5.2", "")).status, "fail");
  assert.equal(qmdVersionCheck(result(0, "qmd 2.5.3", "")).status, "pass");
});

test("accepts only an existing version-matched QMD skill source", () => {
  const source = resolve("skills/setup-workflow-environment");
  assert.equal(resolveQmdSkillSource(result(0, `${source}\n`, "")), source);
  assert.throws(
    () => resolveQmdSkillSource(result(0, "/does/not/exist\n", "")),
    /invalid native skill path/,
  );
});

test("reports the first useful command failure detail", () => {
  assert.equal(
    commandFailure({ status: 1, stdout: "stdout detail", stderr: "" }),
    "stdout detail",
  );
  assert.equal(
    commandFailure({ status: 7, stdout: "", stderr: "" }),
    "exit status 7",
  );
});

test("guides Graphify CLI and native skill installation", () => {
  const missing = graphifyCliCheck({
    target: resolve("fixtures/leaf"),
    agents: ["codex", "claude"],
    runner: result(1, "", "not found"),
  });
  assert.equal(missing.status, "fail");
  assert.equal(missing.remediation?.title, "Install Graphify");
  assert.deepEqual(
    missing.remediation?.steps.flatMap((step) =>
      step.command ? [step.command] : []
    ),
    [
      "uv tool install graphifyy",
      "graphify install --platform codex",
      "graphify install --platform claude",
    ],
  );
  assert.match(
    missing.remediation?.steps.at(-2)?.detail ?? "",
    /Restart the coding agent/,
  );

  const available = graphifyCliCheck({
    target: resolve("fixtures/leaf"),
    agents: ["codex"],
    runner: result(0, "graphify 0.9.26\n", ""),
  });
  assert.equal(available.status, "pass");
  assert.equal(available.remediation, undefined);

  const cliOnly = graphifyCliCheck({
    target: resolve("fixtures/leaf"),
    agents: [],
    runner: result(1, "", "not found"),
  });
  assert.deepEqual(
    cliOnly.remediation?.steps.flatMap((step) =>
      step.command ? [step.command] : []
    ),
    ["uv tool install graphifyy"],
  );
  assert.equal(
    cliOnly.remediation?.steps.some((step) => /Restart/.test(step.detail)),
    false,
  );
});

test("refreshes Graphify from the leaf checkout root", () => {
  const calls: Array<{
    command: string;
    args: string[];
    cwd?: string;
  }> = [];
  const runner: ToolRunner = (command, args, options) => {
    calls.push({ command, args, ...(options?.cwd ? { cwd: options.cwd } : {}) });
    return { status: 0, stdout: "", stderr: "" };
  };
  const sourceRoot = resolve("fixtures/leaf");

  assert.equal(updateGraphifyGraph(sourceRoot, runner).status, 0);
  assert.deepEqual(calls, [{
    command: "graphify",
    args: ["update", "."],
    cwd: sourceRoot,
  }]);
});

test("refreshes Graphify asynchronously for visible CLI progress", async () => {
  const calls: Array<{
    command: string;
    args: string[];
    cwd?: string;
  }> = [];
  const runner: AsyncToolRunner = async (command, args, options) => {
    calls.push({ command, args, ...(options?.cwd ? { cwd: options.cwd } : {}) });
    return { status: 0, stdout: "", stderr: "" };
  };
  const sourceRoot = resolve("fixtures/leaf");

  assert.equal((await updateGraphifyGraphAsync(sourceRoot, runner)).status, 0);
  assert.deepEqual(calls, [{
    command: "graphify",
    args: ["update", "."],
    cwd: sourceRoot,
  }]);
});

function result(status: number, stdout: string, stderr: string): ToolRunner {
  return () => ({ status, stdout, stderr });
}

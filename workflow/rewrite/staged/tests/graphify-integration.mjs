import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = mkdtempSync(join(tmpdir(), "wfctl-graphify-integration-"));

try {
  writeFileSync(
    join(target, "main.ts"),
    "export function greet(name: string): string {\n  return `Hello ${name}`;\n}\n",
  );
  const result = spawnSync(
    "graphify",
    ["update", "."],
    { cwd: target, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const graph = JSON.parse(
    readFileSync(join(target, "graphify-out/graph.json"), "utf8"),
  );
  assert.ok(Array.isArray(graph.nodes) && graph.nodes.length > 0);
  assert.ok(graph.nodes.some((node) => /greet/i.test(node.label ?? "")));
  process.stdout.write("graphify: real integration ok\n");
} finally {
  rmSync(target, { recursive: true, force: true });
}

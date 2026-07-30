import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createReconstructionCoverage,
  evidencePathFromResource,
  markCoverageCommunity,
  markCoverageFiles,
  markSurfaceAudit,
  readPinnedSource,
  recordCoverageSurface,
  validateReconstructionCoverage,
} from "../src/reconstruction-coverage.js";
import { readRepositoryMetadata } from "../src/git.js";

test("accounts for the complete Git tree beyond Graphify and requires full reads", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-coverage-"));
  execFileSync("git", ["-C", root, "init", "-q"]);
  execFileSync("git", ["-C", root, "config", "user.name", "wfctl tests"]);
  execFileSync("git", ["-C", root, "config", "user.email", "wfctl@example.invalid"]);
  execFileSync("git", ["-C", root, "config", "commit.gpgsign", "false"]);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "contracts"), { recursive: true });
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, ".gitignore"), "graphify-out/\n", "utf8");
  await writeFile(
    join(root, "src/main.ts"),
    Array.from(
      { length: 450 },
      (_, index) => `export const value${index + 1} = ${index + 1};`,
    ).join("\n") + "\n",
    "utf8",
  );
  await writeFile(
    join(root, "contracts/service.proto"),
    "syntax = \"proto3\";\nmessage Request {}\n",
    "utf8",
  );
  await writeFile(join(root, "assets/logo.png"), Buffer.from([0, 1, 2, 3]));
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "-q", "-m", "fixture"]);
  const metadata = readRepositoryMetadata(root);
  const graphDirectory = join(root, "graphify-out");
  await mkdir(graphDirectory, { recursive: true });
  const graphPath = join(graphDirectory, "graph.json");
  await writeFile(
    graphPath,
    JSON.stringify({
      nodes: [{
        id: "main",
        label: "main",
        source_file: "src/main.ts",
        community: 7,
        community_name: "Runtime",
      }],
      links: [],
    }),
    "utf8",
  );

  const ledger = await createReconstructionCoverage(
    root,
    metadata.repository,
    metadata.commit,
    graphPath,
    new Date("2026-07-30T10:00:00.000Z"),
  );
  assert.equal(ledger.manifest.files.length, 4);
  assert.deepEqual(
    ledger.manifest.files.find(
      (file) => file.path === "contracts/service.proto",
    )?.graph,
    { indexed: false, communities: [] },
  );
  assert.deepEqual(
    ledger.graphify.communities.map((community) => community.id),
    ["7"],
  );

  readPinnedSource(ledger, root, "src/main.ts", {
    startLine: 1,
    endLine: 400,
    actor: "workflow-agent/test",
    now: new Date("2026-07-30T10:01:00.000Z"),
  });
  assert.throws(
    () =>
      markCoverageFiles(ledger, ["src/main.ts"], {
        status: "inspected",
      }),
    /complete wfctl read receipts/,
  );
  readPinnedSource(ledger, root, "src/main.ts", {
    startLine: 401,
    endLine: 450,
    actor: "workflow-agent/test",
    now: new Date("2026-07-30T10:02:00.000Z"),
  });
  readPinnedSource(ledger, root, ".gitignore", {
    actor: "workflow-agent/test",
    now: new Date("2026-07-30T10:03:00.000Z"),
  });
  markCoverageFiles(ledger, ["contracts/service.proto"], {
    status: "irrelevant",
    reason: "The fixture contract is deliberately outside the bounded question.",
  });
  markCoverageFiles(ledger, ["assets/logo.png"], {
    status: "structural-only",
    reason: "Binary presentation asset has no executable or product-data semantics.",
  });
  markCoverageCommunity(
    ledger,
    "7",
    "inspected",
    "Mapped the only runtime code community.",
    ["Trace the runtime community and its entrypoints."],
  );
  recordCoverageSurface(ledger, {
    id: "runtime-entrypoint",
    kind: "entrypoint",
    description: "Fixture runtime source.",
    paths: ["src/main.ts"],
    status: "inspected",
    note: "The complete pinned source was read.",
    candidateIds: [],
  });
  markSurfaceAudit(
    ledger,
    "reviewed",
    "The only fixture entrypoint was recorded and inspected.",
  );

  assert.deepEqual(
    await validateReconstructionCoverage(
      ledger,
      root,
      metadata.repository,
      metadata.commit,
      graphPath,
    ),
    [],
  );
  assert.equal(
    evidencePathFromResource(
      `git:${metadata.repository}@${metadata.commit}#src/main.ts:value450`,
      metadata.repository,
      metadata.commit,
      ledger.manifest.files.map((file) => file.path),
    ),
    "src/main.ts",
  );

  const removed = ledger.manifest.files.splice(
    ledger.manifest.files.findIndex(
      (file) => file.path === "contracts/service.proto",
    ),
    1,
  );
  assert.equal(removed.length, 1);
  const tampered = await validateReconstructionCoverage(
    ledger,
    root,
    metadata.repository,
    metadata.commit,
    graphPath,
  );
  assert.ok(tampered.some((issue) => /missing tracked file/.test(issue)));
  assert.ok(tampered.some((issue) => /manifest receipt hash is invalid/.test(issue)));
  assert.ok((await readFile(graphPath, "utf8")).includes("Runtime"));
});

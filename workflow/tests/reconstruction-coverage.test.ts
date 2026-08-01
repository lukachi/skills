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

  await readPinnedSource(ledger, root, "src/main.ts", {
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
  await readPinnedSource(ledger, root, "src/main.ts", {
    startLine: 401,
    endLine: 450,
    actor: "workflow-agent/test",
    now: new Date("2026-07-30T10:02:00.000Z"),
  });
  await readPinnedSource(ledger, root, ".gitignore", {
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

async function workflowLeafFixture(): Promise<{ root: string; graphPath: string }> {
  const root = await mkdtemp(join(tmpdir(), "wfctl-coverage-workflow-"));
  execFileSync("git", ["-C", root, "init", "-q"]);
  execFileSync("git", ["-C", root, "config", "user.name", "wfctl tests"]);
  execFileSync("git", ["-C", root, "config", "user.email", "wfctl@example.invalid"]);
  execFileSync("git", ["-C", root, "config", "commit.gpgsign", "false"]);

  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src/main.ts"), "export const value = 1;\n", "utf8");
  await writeFile(join(root, ".gitignore"), "graphify-out/\n", "utf8");

  // What wfctl installed and recorded as its own.
  await mkdir(join(root, ".workflow/rules"), { recursive: true });
  await writeFile(
    join(root, ".workflow/rules/evidence-first.md"),
    "Agent rule.\n",
    "utf8",
  );
  await writeFile(
    join(root, ".workflow/state.json"),
    JSON.stringify({
      schemaVersion: 1,
      installedVersion: "0.8.0",
      profile: "leaf",
      files: { ".workflow/rules/evidence-first.md": { sha256: "0".repeat(64) } },
    }),
    "utf8",
  );
  await writeFile(join(root, "AGENTS.md"), "# Project\n\nManaged block plus my own notes.\n", "utf8");

  // One skill wfctl ships, one the project authored itself.
  await mkdir(join(root, ".claude/skills/implement-work-item"), { recursive: true });
  await writeFile(
    join(root, ".claude/skills/implement-work-item/SKILL.md"),
    "---\nname: implement-work-item\n---\n",
    "utf8",
  );
  await mkdir(join(root, ".claude/skills/deploy-our-service"), { recursive: true });
  await writeFile(
    join(root, ".claude/skills/deploy-our-service/SKILL.md"),
    "---\nname: deploy-our-service\n---\n",
    "utf8",
  );
  await writeFile(
    join(root, "skills-lock.json"),
    JSON.stringify({
      skills: {
        "implement-work-item": { source: "/somewhere/workflow", sourceType: "local" },
        "deploy-our-service": { source: "./skills", sourceType: "local" },
      },
    }),
    "utf8",
  );

  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "-q", "-m", "fixture"]);

  const graphDirectory = join(root, "graphify-out");
  await mkdir(graphDirectory, { recursive: true });
  const graphPath = join(graphDirectory, "graph.json");
  await writeFile(
    graphPath,
    JSON.stringify({
      nodes: [{ id: "main", label: "main", source_file: "src/main.ts", community: 1 }],
      links: [],
    }),
    "utf8",
  );
  return { root, graphPath };
}

test("dispositions wfctl's own installed files without excluding project-authored ones", async () => {
  const { root, graphPath } = await workflowLeafFixture();
  const metadata = readRepositoryMetadata(root);
  const ledger = await createReconstructionCoverage(
    root,
    metadata.repository,
    metadata.commit,
    graphPath,
    new Date("2026-08-02T10:00:00.000Z"),
  );
  const file = (path: string) => ledger.manifest.files.find((entry) => entry.path === path);

  // Recorded in .workflow/state.json: wholly wfctl's.
  assert.equal(file(".workflow/rules/evidence-first.md")?.category, "workflow-asset");
  assert.equal(file(".workflow/rules/evidence-first.md")?.status, "irrelevant");
  assert.match(file(".workflow/rules/evidence-first.md")?.reason ?? "", /Installed by wfctl/);
  assert.equal(file(".workflow/state.json")?.status, "irrelevant");

  // A skill wfctl ships and the lock confirms.
  assert.equal(file(".claude/skills/implement-work-item/SKILL.md")?.category, "workflow-asset");
  assert.equal(file(".claude/skills/implement-work-item/SKILL.md")?.status, "irrelevant");

  // A skill the project wrote sits in the same directory and stays in scope.
  assert.equal(file(".claude/skills/deploy-our-service/SKILL.md")?.category, "documentation");
  assert.equal(file(".claude/skills/deploy-our-service/SKILL.md")?.status, "pending");

  // Managed-block files carry project text too: named, never auto-dispositioned.
  assert.equal(file("AGENTS.md")?.category, "workflow-asset");
  assert.equal(file("AGENTS.md")?.status, "pending");

  // Product source is untouched by any of this.
  assert.equal(file("src/main.ts")?.category, "source");
  assert.equal(file("src/main.ts")?.status, "pending");

  const issues = await validateReconstructionCoverage(
    ledger,
    root,
    metadata.repository,
    metadata.commit,
    graphPath,
  );
  assert.equal(
    issues.some((issue) => /workflow-asset|unknown file category/.test(issue)),
    false,
    `validation must accept the new category: ${issues.join("; ")}`,
  );
});

test("keeps every file in scope when the repository is not a workflow leaf", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-coverage-plain-"));
  execFileSync("git", ["-C", root, "init", "-q"]);
  execFileSync("git", ["-C", root, "config", "user.name", "wfctl tests"]);
  execFileSync("git", ["-C", root, "config", "user.email", "wfctl@example.invalid"]);
  execFileSync("git", ["-C", root, "config", "commit.gpgsign", "false"]);
  await mkdir(join(root, ".claude/skills/deploy"), { recursive: true });
  await writeFile(join(root, ".claude/skills/deploy/SKILL.md"), "---\nname: deploy\n---\n", "utf8");
  await writeFile(join(root, "AGENTS.md"), "# Ours alone\n", "utf8");
  await writeFile(join(root, "main.ts"), "export const value = 1;\n", "utf8");
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "-q", "-m", "fixture"]);

  const graphDirectory = join(root, "graphify-out");
  await mkdir(graphDirectory, { recursive: true });
  const graphPath = join(graphDirectory, "graph.json");
  await writeFile(
    graphPath,
    JSON.stringify({
      nodes: [{ id: "main", label: "main", source_file: "main.ts", community: 1 }],
      links: [],
    }),
    "utf8",
  );
  const metadata = readRepositoryMetadata(root);
  const ledger = await createReconstructionCoverage(
    root,
    metadata.repository,
    metadata.commit,
    graphPath,
    new Date("2026-08-02T10:00:00.000Z"),
  );

  assert.equal(
    ledger.manifest.files.every((file) => file.status === "pending"),
    true,
    "a repository with no wfctl manifest must keep every file in scope",
  );
  assert.equal(
    ledger.manifest.files.some((file) => file.category === "workflow-asset"),
    false,
  );
});

test("explains a stale Graphify pin instead of implying the source is corrupt", async () => {
  const { root, graphPath } = await workflowLeafFixture();
  const metadata = readRepositoryMetadata(root);
  await writeFile(
    graphPath,
    JSON.stringify({
      nodes: [{ id: "main", label: "main", source_file: "src/main.ts", community: 1 }],
      links: [],
      built_at_commit: "b".repeat(40),
    }),
    "utf8",
  );

  await assert.rejects(
    createReconstructionCoverage(
      root,
      metadata.repository,
      metadata.commit,
      graphPath,
      new Date("2026-08-02T10:00:00.000Z"),
    ),
    (error: Error) => {
      assert.match(error.message, /the checkout is at/);
      assert.match(error.message, /topology did not change/);
      assert.match(error.message, /--force does not refresh the pin/);
      assert.match(error.message, /rm .*graph\.json && graphify update \./);
      return true;
    },
  );
});

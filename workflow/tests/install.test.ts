import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { applyInstallPlan } from "../src/applier.js";
import { doctorPassed, runDoctor } from "../src/doctor.js";
import { buildInstallPlan } from "../src/planner.js";

const distributionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("installs a knowledge profile and converges to an unchanged plan", async () => {
  const target = await temporaryDirectory("wfctl-knowledge-");
  const first = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.equal(first.operations.some((operation) => operation.status === "conflict"), false);
  await applyInstallPlan(first);

  assert.match(await readFile(join(target, "AGENTS.md"), "utf8"), /wfctl:begin/);
  assert.equal(await readlink(join(target, "CLAUDE.md")), "AGENTS.md");
  assert.match(await readFile(join(target, "knowledge/index.md"), "utf8"), /okf_version/);
  await access(join(target, ".agents/skills/setup-workflow-environment/SKILL.md"));
  await access(join(target, ".agents/skills/analyze-with-graphify/SKILL.md"));
  await access(join(target, ".agents/skills/curate-project-knowledge/SKILL.md"));
  await assert.rejects(access(join(target, ".agents/skills/manage-project-work/SKILL.md")));

  const second = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.equal(
    second.operations.every((operation) => operation.status === "unchanged"),
    true,
  );
});

test("preserves existing instruction files and existing Claude skills directory", async () => {
  const target = await temporaryDirectory("wfctl-preserve-");
  await writeFile(join(target, "AGENTS.md"), "# Existing agents\n", "utf8");
  await writeFile(join(target, "CLAUDE.md"), "# Existing Claude\n", "utf8");
  await mkdir(join(target, ".claude/skills"), { recursive: true });
  await mkdir(join(target, ".claude/skills/custom-skill"), { recursive: true });

  const plan = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  assert.equal(plan.operations.some((operation) => operation.status === "conflict"), false);
  await applyInstallPlan(plan);

  assert.match(await readFile(join(target, "AGENTS.md"), "utf8"), /^# Existing agents/m);
  assert.match(await readFile(join(target, "CLAUDE.md"), "utf8"), /^# Existing Claude/m);
  assert.equal(
    await readlink(join(target, ".claude/skills/analyze-with-graphify")),
    "../../.agents/skills/analyze-with-graphify",
  );
  assert.match(
    await readFile(join(target, ".agents/skills/curate-project-knowledge/SKILL.md"), "utf8"),
    /Curate current truth/,
  );
  await assert.rejects(access(join(target, ".agents/skills/manage-project-work/SKILL.md")));

  const syncPlan = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  await applyInstallPlan(syncPlan);
  assert.match(await readFile(join(target, "AGENTS.md"), "utf8"), /^# Existing agents/m);
  assert.match(await readFile(join(target, "CLAUDE.md"), "utf8"), /^# Existing Claude/m);
  assert.equal(
    await readlink(join(target, ".claude/skills/analyze-with-graphify")),
    "../../.agents/skills/analyze-with-graphify",
  );
});

test("reports a conflict when an owned file was locally modified", async () => {
  const target = await temporaryDirectory("wfctl-conflict-");
  const first = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  await applyInstallPlan(first);
  const owned = join(target, ".workflow/rules/evidence-first.md");
  await writeFile(owned, `${await readFile(owned, "utf8")}\nLocal edit.\n`, "utf8");

  const second = await buildInstallPlan({
    target,
    profile: "knowledge",
    distributionRoot,
  });
  const conflict = second.operations.find((operation) =>
    operation.path === ".workflow/rules/evidence-first.md"
  );
  assert.equal(conflict?.status, "conflict");
  assert.match(conflict?.reason ?? "", /locally modified/);
});

test("doctor accepts initialized knowledge and leaf repositories", async () => {
  const root = await temporaryDirectory("wfctl-doctor-");
  const knowledge = join(root, "knowledge");
  const leaf = join(root, "leaf");
  await mkdir(knowledge);
  await mkdir(leaf);
  execFileSync("git", ["-C", knowledge, "init", "-q"]);
  execFileSync("git", ["-C", leaf, "init", "-q"]);

  await applyInstallPlan(await buildInstallPlan({
    target: knowledge,
    profile: "knowledge",
    distributionRoot,
  }));
  await applyInstallPlan(await buildInstallPlan({
    target: leaf,
    profile: "leaf",
    knowledge,
    distributionRoot,
  }));
  await mkdir(join(leaf, "graphify-out"));
  await writeFile(join(leaf, "graphify-out/graph.json"), "{}\n", "utf8");

  await access(join(leaf, ".agents/skills/setup-workflow-environment/SKILL.md"));
  await access(join(leaf, ".agents/skills/analyze-with-graphify/SKILL.md"));
  await access(join(leaf, ".agents/skills/align-project-knowledge/SKILL.md"));
  await access(join(leaf, ".agents/skills/manage-project-work/SKILL.md"));
  await access(join(leaf, ".agents/skills/verify-project-work/SKILL.md"));
  await assert.rejects(access(join(leaf, ".agents/skills/curate-project-knowledge/SKILL.md")));

  assert.equal(
    doctorPassed(await runDoctor(knowledge, { graphifyAvailable: true })),
    true,
  );
  assert.equal(
    doctorPassed(await runDoctor(leaf, { graphifyAvailable: true })),
    true,
  );
});

async function temporaryDirectory(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix));
}

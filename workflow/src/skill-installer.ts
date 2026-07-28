import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { resolveQmdSkillSource } from "./dependencies.js";
import type { AgentTarget, Profile, SkillScope } from "./types.js";
import {
  allWorkflowSkills,
  workflowSkillsForProfile,
} from "./planner.js";

export interface InstallSkillsOptions {
  target: string;
  distributionRoot: string;
  profile: Profile;
  scope: SkillScope;
  agents: AgentTarget[];
  yes: boolean;
}

export interface InstalledSkill {
  name: string;
  path: string;
  agents: string[];
}

export function installSkills(options: InstallSkillsOptions): void {
  installSkillsTransactional(options).commit();
}

export interface SkillInstallTransaction {
  commit(): void;
  rollback(): void;
}

export function installSkillsTransactional(
  options: InstallSkillsOptions,
): SkillInstallTransaction {
  const transaction = snapshotSkillInstall(options);
  try {
    reconcileProjectWorkflowSkills(options);
    if (options.scope !== "none" && options.agents.length > 0) {
      const cli = resolveSkillsCli();
      const qmdSkillSource = resolveQmdSkillSource();
      installSkillSource(
        cli,
        resolve(options.distributionRoot),
        workflowSkillsForProfile(options.profile),
        options,
      );
      installSkillSource(cli, qmdSkillSource, ["qmd"], options);
    }
    return transaction;
  } catch (error) {
    transaction.rollback();
    throw error;
  }
}

function installSkillSource(
  cli: string,
  source: string,
  skills: string[],
  options: InstallSkillsOptions,
): void {
  const args = [
    cli,
    "add",
    source,
    ...skills.flatMap((skill) => ["--skill", skill]),
    ...options.agents.flatMap((agent) => [
      "--agent",
      agent === "claude" ? "claude-code" : "codex",
    ]),
    "--copy",
    ...(options.scope === "user" ? ["--global"] : []),
    ...(options.yes ? ["--yes"] : []),
  ];
  const runtime = runtimeCommand(cli, args.slice(1));
  const result = spawnSync(runtime.command, runtime.args, {
    cwd: resolve(options.target),
    encoding: "utf8",
    stdio: options.yes ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = options.yes
      ? result.stderr.trim() || result.stdout.trim()
      : "skills installer exited without completing";
    throw new Error(`Skill installation failed from ${source}: ${detail}`);
  }
}

export function listInstalledSkills(
  target: string,
  global: boolean,
): InstalledSkill[] {
  const cli = resolveSkillsCli();
  const args = [cli, "list", "--json", ...(global ? ["--global"] : [])];
  const runtime = runtimeCommand(cli, args.slice(1));
  const result = spawnSync(runtime.command, runtime.args, {
    cwd: resolve(target),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `Cannot list ${global ? "user" : "project"} skills: ${
        result.stderr.trim() || result.stdout.trim()
      }`,
    );
  }
  const value = JSON.parse(result.stdout) as unknown;
  if (!Array.isArray(value)) {
    throw new Error("skills CLI returned a non-list result");
  }
  return value.filter((entry): entry is InstalledSkill =>
    typeof entry === "object"
    && entry !== null
    && typeof (entry as InstalledSkill).name === "string"
    && typeof (entry as InstalledSkill).path === "string"
    && Array.isArray((entry as InstalledSkill).agents)
  );
}

function resolveSkillsCli(): string {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("skills/package.json");
  return join(dirname(packagePath), "bin/cli.mjs");
}

function reconcileProjectWorkflowSkills(options: InstallSkillsOptions): void {
  const lockPath = join(options.target, "skills-lock.json");
  if (!existsSync(lockPath)) {
    return;
  }
  let lock: {
    skills?: Record<string, { source?: string; sourceType?: string }>;
  };
  try {
    lock = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    return;
  }
  const distributionRoot = resolve(options.distributionRoot);
  const owned = allWorkflowSkills().filter((skill) => {
    const entry = lock.skills?.[skill];
    return entry?.sourceType === "local"
      && entry.source
      && resolve(entry.source) === distributionRoot;
  });
  if (owned.length === 0) {
    return;
  }

  const desired = options.scope === "project"
    ? new Set(workflowSkillsForProfile(options.profile))
    : new Set<string>();
  const selectedAgents = options.scope === "project"
    ? new Set(options.agents)
    : new Set<AgentTarget>();
  const cli = resolveSkillsCli();
  for (const skill of owned) {
    for (const agent of ["codex", "claude"] as AgentTarget[]) {
      const path = agent === "codex"
        ? join(options.target, ".agents/skills", skill)
        : join(options.target, ".claude/skills", skill);
      if (
        !existsSync(path)
        || (desired.has(skill) && selectedAgents.has(agent))
      ) {
        continue;
      }
      const args = [
        cli,
        "remove",
        skill,
        "--agent",
        agent === "claude" ? "claude-code" : "codex",
        "--yes",
      ];
      const runtime = runtimeCommand(cli, args.slice(1));
      const result = spawnSync(runtime.command, runtime.args, {
        cwd: resolve(options.target),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (result.status !== 0) {
        throw new Error(
          `Cannot remove obsolete wfctl skill ${skill} from ${agent}: ${
            result.stderr.trim() || result.stdout.trim()
          }`,
        );
      }
    }
  }
}

function runtimeCommand(cli: string, args: string[]): {
  command: string;
  args: string[];
} {
  if ("Deno" in globalThis) {
    return { command: process.execPath, args: ["run", "-A", cli, ...args] };
  }
  return { command: process.execPath, args: [cli, ...args] };
}

interface SkillPathSnapshot {
  path: string;
  kind: "absent" | "file" | "directory" | "symlink";
  backup?: string;
  linkTarget?: string;
}

function snapshotSkillInstall(
  options: InstallSkillsOptions,
): SkillInstallTransaction {
  const root = mkdtempSync(join(tmpdir(), "wfctl-skills-"));
  const names = [...new Set([...allWorkflowSkills(), "qmd"])];
  const paths = new Set<string>();
  for (const agent of options.agents) {
    const base = options.scope === "user"
      ? globalSkillRoot(agent)
      : join(
        resolve(options.target),
        agent === "codex" ? ".agents/skills" : ".claude/skills",
      );
    for (const name of names) {
      paths.add(join(base, name));
    }
  }
  if (options.scope === "project") {
    paths.add(join(resolve(options.target), "skills-lock.json"));
  }
  const snapshots = [...paths].map((path, index) =>
    snapshotSkillPath(path, root, index)
  );
  let finished = false;
  const cleanup = () => {
    rmSync(root, { recursive: true, force: true });
    finished = true;
  };
  return {
    commit() {
      if (!finished) {
        cleanup();
      }
    },
    rollback() {
      if (finished) {
        return;
      }
      try {
        for (const snapshot of snapshots.reverse()) {
          restoreSkillPath(snapshot);
        }
      } finally {
        cleanup();
      }
    },
  };
}

function snapshotSkillPath(
  path: string,
  root: string,
  index: number,
): SkillPathSnapshot {
  if (!existsSync(path)) {
    return { path, kind: "absent" };
  }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    return { path, kind: "symlink", linkTarget: readlinkSync(path) };
  }
  const backup = join(root, String(index));
  if (stat.isDirectory()) {
    cpSync(path, backup, { recursive: true, verbatimSymlinks: true });
    return { path, kind: "directory", backup };
  }
  cpSync(path, backup);
  return { path, kind: "file", backup };
}

function restoreSkillPath(snapshot: SkillPathSnapshot): void {
  rmSync(snapshot.path, { recursive: true, force: true });
  if (snapshot.kind === "absent") {
    return;
  }
  mkdirSync(dirname(snapshot.path), { recursive: true });
  if (snapshot.kind === "symlink") {
    symlinkSync(snapshot.linkTarget!, snapshot.path);
    return;
  }
  cpSync(snapshot.backup!, snapshot.path, {
    recursive: snapshot.kind === "directory",
    verbatimSymlinks: true,
  });
}

function globalSkillRoot(agent: AgentTarget): string {
  if (agent === "codex") {
    return join(process.env.CODEX_HOME?.trim() || join(homedir(), ".codex"), "skills");
  }
  return join(
    process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude"),
    "skills",
  );
}

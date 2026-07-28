import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AgentTarget, Profile, SkillScope } from "./types.js";
import { skillsForProfile } from "./planner.js";

export interface InstallSkillsOptions {
  target: string;
  distributionRoot: string;
  profile: Profile;
  scope: SkillScope;
  agents: AgentTarget[];
  yes: boolean;
}

export function installSkills(options: InstallSkillsOptions): void {
  if (options.scope === "none" || options.agents.length === 0) {
    return;
  }
  if (options.yes) {
    assertNonInteractiveInstallIsClean(options);
  }

  const cli = resolveSkillsCli();
  const args = [
    cli,
    "add",
    resolve(options.distributionRoot),
    ...skillsForProfile(options.profile).flatMap((skill) => ["--skill", skill]),
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
    throw new Error(`Skill installation failed: ${detail}`);
  }
}

function assertNonInteractiveInstallIsClean(options: InstallSkillsOptions): void {
  if (options.scope === "user") {
    throw new Error(
      "Refusing non-interactive user-scope skill replacement; rerun without --yes",
    );
  }
  for (const skill of skillsForProfile(options.profile)) {
    const paths = [
      ...(options.agents.includes("codex")
        ? [join(options.target, ".agents/skills", skill)]
        : []),
      ...(options.agents.includes("claude")
        ? [join(options.target, ".claude/skills", skill)]
        : []),
    ];
    const existing = paths.find((path) => existsSync(path));
    if (existing) {
      throw new Error(
        `Refusing non-interactive skill replacement at ${existing}; rerun without --yes`,
      );
    }
  }
}

function resolveSkillsCli(): string {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("skills/package.json");
  return join(dirname(packagePath), "bin/cli.mjs");
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

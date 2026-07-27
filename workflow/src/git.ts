import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import type { RepositoryMetadata } from "./types.js";

export function readRepositoryMetadata(root: string): RepositoryMetadata {
  const topLevel = git(root, ["rev-parse", "--show-toplevel"], true);
  const gitDirRaw = git(root, ["rev-parse", "--git-dir"], true);
  const commonDirRaw = git(root, ["rev-parse", "--git-common-dir"], true);
  const branch = git(root, ["symbolic-ref", "--short", "-q", "HEAD"]) || "DETACHED";
  const commit = git(root, ["rev-parse", "HEAD"]) || "unknown";
  const remote = git(root, ["config", "--get", "remote.origin.url"]);
  const gitDir = resolve(topLevel, gitDirRaw);
  const commonDir = resolve(topLevel, commonDirRaw);

  return {
    repository: repositoryId(remote, commonDir),
    checkout: basename(topLevel),
    branch,
    commit,
    remote,
    worktree: gitDir !== commonDir,
  };
}

export function isGitRepository(root: string): boolean {
  const result = spawnSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 && result.stdout.trim() === "true";
}

function git(root: string, args: string[], required = false): string {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    if (required) {
      const detail = result.stderr.trim() || args.join(" ");
      throw new Error(`Git metadata unavailable: ${detail}`);
    }
    return "";
  }
  return result.stdout.trim();
}

function repositoryId(remote: string, commonDir: string): string {
  if (remote) {
    const normalized = remote.replace(/\/+$/, "").replace(/\.git$/, "");
    const match = normalized.match(/([^/:]+\/[^/]+)$/);
    if (match?.[1]) {
      return match[1].replace(/[^a-zA-Z0-9._/-]/g, "-");
    }
  }
  const parent = commonDir.endsWith("/.git") ? commonDir.slice(0, -5) : commonDir;
  return basename(parent);
}

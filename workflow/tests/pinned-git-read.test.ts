import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readPinnedGitTextRange } from "../src/pinned-git-read.js";

test("streams past large unselected lines and bounds the selected window", async () => {
  const root = await mkdtemp(join(tmpdir(), "wfctl-pinned-stream-"));
  execFileSync("git", ["-C", root, "init", "-q"]);
  execFileSync("git", ["-C", root, "config", "user.name", "wfctl tests"]);
  execFileSync("git", ["-C", root, "config", "user.email", "wfctl@example.invalid"]);
  execFileSync("git", ["-C", root, "config", "commit.gpgsign", "false"]);
  await writeFile(join(root, "large.txt"), `${"x".repeat(4096)}\ntarget\n`, "utf8");
  execFileSync("git", ["-C", root, "add", "large.txt"]);
  execFileSync("git", ["-C", root, "commit", "-q", "-m", "fixture"]);

  const selected = await readPinnedGitTextRange(
    root,
    ["show", "HEAD:large.txt"],
    { startLine: 2, endLine: 2, maxSelectedBytes: 1024 },
  );
  assert.equal(selected.content, "target");
  assert.equal(selected.totalLines, 2);

  await assert.rejects(
    readPinnedGitTextRange(
      root,
      ["show", "HEAD:large.txt"],
      { startLine: 1, endLine: 1, maxSelectedBytes: 1024 },
    ),
    /selected line window exceeds 1024 bytes/,
  );
});

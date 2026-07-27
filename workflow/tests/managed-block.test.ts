import assert from "node:assert/strict";
import test from "node:test";
import {
  containsManagedBlock,
  renderManagedBlock,
  upsertManagedBlock,
} from "../src/managed-block.js";

test("adds a managed block without changing existing instructions", () => {
  const existing = "# Existing\n\nKeep this.\n";
  const result = upsertManagedBlock(existing, "## Workflow\n\nManaged.");
  assert.equal(
    result.content,
    "# Existing\n\nKeep this.\n\n<!-- wfctl:begin -->\n## Workflow\n\nManaged.\n<!-- wfctl:end -->\n",
  );
});

test("updates only the existing managed block", () => {
  const existing = [
    "Before",
    "",
    renderManagedBlock("Old"),
    "",
    "After",
    "",
  ].join("\n");
  const result = upsertManagedBlock(existing, "New");
  assert.equal(
    result.content,
    [
      "Before",
      "",
      renderManagedBlock("New"),
      "",
      "After",
      "",
    ].join("\n"),
  );
  assert.equal(containsManagedBlock(result.content ?? ""), true);
});

test("rejects malformed markers", () => {
  const result = upsertManagedBlock("<!-- wfctl:begin -->\nmissing end", "New");
  assert.match(result.error ?? "", /malformed/);
});

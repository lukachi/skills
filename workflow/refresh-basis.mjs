// Recompute a work record's checkpoint fingerprint with the tool's own algorithm.
// The workaround the `a-written-task-can-be-started` bundle documents: a record whose body was
// written after its checkpoint cannot be claimed, because the claim gate refuses a stale
// fingerprint and the checkpoint command refuses an unclaimed issue.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";

const path = process.argv[2];
const raw = readFileSync(path, "utf8");
const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!match) throw new Error("no frontmatter");
const metadata = YAML.parse(match[1]);
const body = match[2];

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stableValue(value[k])]));
  }
  return value;
}

const forHash = { ...metadata };
delete forHash.checkpoint;
delete forHash.updated_at;
const digest = createHash("sha256")
  .update(Buffer.from(JSON.stringify(stableValue({ metadata: forHash, body }))))
  .digest("hex");

metadata.checkpoint.basis_sha256 = digest;
const out = "---\n" + YAML.stringify(metadata, { lineWidth: 0 }).trimEnd() + "\n---\n" + body;
writeFileSync(path, out);
console.log("basis", digest);

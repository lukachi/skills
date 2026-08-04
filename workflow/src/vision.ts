import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isMissingFileError } from "./config.js";
import { serializeWorkSpec } from "./work-spec.js";

/**
 * Declared visions.
 *
 * A vision is what a product subject should become. It is the one thing in this
 * workflow the agent may never produce: recovering what a project meant and
 * declaring what it should be are different acts, and only the second carries
 * authority over direction.
 *
 * The integrity property is the same one `wfctl work approve` establishes, for
 * the same reason. A vision written as ordinary YAML could be authored by the
 * same unattended pass that assembled the trajectory it answers. So a vision is
 * produced on a separate code path that requires an interactive terminal or an
 * out-of-band token, and it is bound to an ignored runtime record that ordinary
 * record editing does not touch. This does not authenticate a person. It makes
 * a forged vision require a deliberate second file rather than one more line in
 * a document the agent was already writing.
 */

export const VISION_METHODS = ["interactive", "token"] as const;
export type VisionMethod = (typeof VISION_METHODS)[number];

export interface VisionRecord {
  schemaVersion: 1;
  id: string;
  trajectory: string;
  declaredBy: string;
  at: string;
  method: VisionMethod;
  supersedes: string;
  receipt: string;
}

export interface DeclareVisionOptions {
  knowledgeRoot: string;
  id: string;
  trajectory: string;
  declaredBy: string;
  statement: string;
  method: VisionMethod;
  supersedes?: string;
  now?: Date;
}

export function visionReceiptDigest(input: {
  id: string;
  trajectory: string;
  declaredBy: string;
  at: string;
  method: VisionMethod;
}): string {
  return createHash("sha256")
    .update(
      [input.id, input.trajectory, input.declaredBy, input.at, input.method].join(" "),
      "utf8",
    )
    .digest("hex");
}

export function visionRecordPath(knowledgeRoot: string, id: string): string {
  return join(knowledgeRoot, ".workflow/current/visions", `${id}.json`);
}

export function visionDocumentPath(knowledgeRoot: string, id: string): string {
  return join(knowledgeRoot, "trajectories", `${id}.md`);
}

export async function declareVision(
  options: DeclareVisionOptions,
): Promise<VisionRecord & { path: string; documentPath: string }> {
  const declaredBy = options.declaredBy.trim();
  if (!declaredBy.startsWith("human:") || declaredBy.length <= "human:".length) {
    throw new Error("A vision requires --by human:<maintainer-id>");
  }
  if (!VISION_METHODS.includes(options.method)) {
    throw new Error(`Unsupported vision method: ${options.method}`);
  }
  const statement = options.statement.trim();
  if (!statement) {
    throw new Error("A vision requires a statement of what the subject should become");
  }
  const at = (options.now ?? new Date()).toISOString();
  const record: VisionRecord = {
    schemaVersion: 1,
    id: options.id,
    trajectory: options.trajectory,
    declaredBy,
    at,
    method: options.method,
    supersedes: (options.supersedes ?? "").trim(),
    receipt: visionReceiptDigest({
      id: options.id,
      trajectory: options.trajectory,
      declaredBy,
      at,
      method: options.method,
    }),
  };

  const path = visionRecordPath(options.knowledgeRoot, options.id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const documentPath = visionDocumentPath(options.knowledgeRoot, options.id);
  await mkdir(dirname(documentPath), { recursive: true });
  await writeFile(
    documentPath,
    serializeWorkSpec({
      metadata: {
        kind: "vision",
        id: record.id,
        trajectory: record.trajectory,
        declared_by: record.declaredBy,
        at: record.at,
        method: record.method,
        supersedes: record.supersedes,
        receipt: record.receipt,
      },
      body: `# ${record.id}\n\n${statement}\n`,
    }),
    "utf8",
  );
  return { ...record, path, documentPath };
}

export async function readVisionRecord(
  knowledgeRoot: string,
  id: string,
): Promise<VisionRecord | undefined> {
  try {
    const raw = JSON.parse(
      await readFile(visionRecordPath(knowledgeRoot, id), "utf8"),
    ) as unknown;
    return isVisionRecord(raw) ? raw : undefined;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isVisionRecord(value: unknown): value is VisionRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && typeof record.id === "string"
    && typeof record.trajectory === "string"
    && typeof record.declaredBy === "string"
    && typeof record.at === "string"
    && VISION_METHODS.includes(record.method as VisionMethod)
    && typeof record.supersedes === "string"
    && typeof record.receipt === "string";
}

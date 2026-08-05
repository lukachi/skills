import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isMissingFileError } from "./config.js";
import { serializeWorkSpec } from "./work-spec.js";

/**
 * Declared visions.
 *
 * A vision is what a product subject should become, and the answer is the
 * maintainer's alone: recovering what a project meant and declaring what it
 * should be are different acts, and only the second carries authority over
 * direction.
 *
 * Three methods, deliberately unequal, and the record says which one it was.
 *
 * `interactive` and `token` are the property `wfctl work approve` establishes: a
 * separate code path an unattended pass cannot take. They prove a command ran
 * outside the agent's own writing, and nothing more — not who typed it, not that
 * they read the statement.
 *
 * `attested` is the ordinary path, because the ordinary case is a maintainer who
 * already answered in conversation. Requiring them to retype a command with a
 * generated slug, a generated id and their own name is clerical work handed to
 * the person who is supposed to be deciding about the product. So the agent
 * records it and stores the maintainer's own words alongside the statement.
 *
 * An agent can fabricate an attestation. What the field buys is that fabricating
 * becomes a lie in a named place rather than an absence, and a lie in a field
 * that reads "here is what you said" is found by the person who said it. That is
 * weaker than a receipt from another channel, which is exactly why the methods
 * stay distinguishable instead of collapsing into "approved".
 */

export const VISION_METHODS = ["attested", "interactive", "token"] as const;
export type VisionMethod = (typeof VISION_METHODS)[number];

/** Methods whose authority rests on a recorded answer rather than a channel. */
export const ATTESTED_METHODS = new Set<VisionMethod>(["attested"]);

export interface VisionRecord {
  schemaVersion: 1;
  id: string;
  trajectory: string;
  declaredBy: string;
  at: string;
  method: VisionMethod;
  supersedes: string;
  /** The maintainer's own words, for an attested declaration. */
  attested: string;
  /** Where those words were said, so they can be read back. */
  session: string;
  receipt: string;
}

export interface DeclareVisionOptions {
  knowledgeRoot: string;
  id?: string;
  trajectory: string;
  declaredBy: string;
  statement: string;
  method: VisionMethod;
  attested?: string;
  session?: string;
  supersedes?: string;
  now?: Date;
}

/**
 * Derived rather than asked for. An id is the agent's bookkeeping, and a
 * maintainer should never be handed one to retype.
 */
export function visionIdFor(trajectory: string, existing: string[]): string {
  const base = `vision-${trajectory.replace(/^traj-/, "")}`;
  if (!existing.includes(base)) {
    return base;
  }
  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.includes(candidate)) {
      return candidate;
    }
  }
}

export function visionReceiptDigest(input: {
  id: string;
  trajectory: string;
  declaredBy: string;
  at: string;
  method: VisionMethod;
  attested?: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.id,
        input.trajectory,
        input.declaredBy,
        input.at,
        input.method,
        input.attested ?? "",
      ].join(" "),
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
  const attested = (options.attested ?? "").trim();
  if (ATTESTED_METHODS.has(options.method) && !attested) {
    throw new Error(
      "An attested vision requires the maintainer's own answer; without it there is "
        + "nothing distinguishing a recorded decision from an invented one",
    );
  }
  if (!ATTESTED_METHODS.has(options.method) && attested) {
    throw new Error(
      `A ${options.method} vision carries its own proof; do not also record an attestation`,
    );
  }
  const id = options.id
    ?? visionIdFor(options.trajectory, await existingVisionIds(options.knowledgeRoot));
  const at = (options.now ?? new Date()).toISOString();
  const record: VisionRecord = {
    schemaVersion: 1,
    id,
    trajectory: options.trajectory,
    declaredBy,
    at,
    method: options.method,
    supersedes: (options.supersedes ?? "").trim(),
    attested,
    session: (options.session ?? "").trim(),
    receipt: visionReceiptDigest({
      id,
      trajectory: options.trajectory,
      declaredBy,
      at,
      method: options.method,
      attested,
    }),
  };

  const path = visionRecordPath(options.knowledgeRoot, record.id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const documentPath = visionDocumentPath(options.knowledgeRoot, record.id);
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
        attested: record.attested,
        session: record.session,
        receipt: record.receipt,
      },
      body: attested
        ? `# ${record.id}\n\n${statement}\n\n## What the maintainer said\n\n> ${
          attested.split(/\r?\n/).join("\n> ")
        }\n`
        : `# ${record.id}\n\n${statement}\n`,
    }),
    "utf8",
  );
  return { ...record, path, documentPath };
}

async function existingVisionIds(knowledgeRoot: string): Promise<string[]> {
  try {
    return (await readdir(join(knowledgeRoot, ".workflow/current/visions")))
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => entry.replace(/\.json$/, ""));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
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
    && typeof record.attested === "string"
    && typeof record.session === "string"
    && typeof record.receipt === "string";
}

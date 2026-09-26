import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import { contains } from "./paths-resolve.js";

const ACTIVE = "changes/active";

function name(value: string, kind: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value) || value.includes("..")) {
    throw new GateRefusal(
      `Invalid ${kind}: ${value || "(empty)"}.`,
      `Use a short lowercase ${kind} with letters, numbers, dots, dashes, or underscores.`,
    );
  }
  return value;
}

function required(value: string, label: string): string {
  if (!value.trim()) throw new GateRefusal(`${label} is required.`, `Provide --${label} "<text>".`);
  return value.trim();
}

function line(value: string, label: string): string {
  const text = required(value, label);
  if (/[\r\n]/.test(text)) throw new GateRefusal(`${label} must be one line.`, `Provide --${label} "<text>".`);
  return text;
}

function inside(root: string, ...parts: string[]): string {
  const base = resolve(root, ACTIVE);
  const path = resolve(base, ...parts);
  if (!contains(base, path)) throw new GateRefusal("Record path leaves changes/active.", "Use a record inside this repository.");
  return path;
}

async function read(path: string, label: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new GateRefusal(`${label} does not exist.`, "List records and choose an existing one.");
    }
    throw error;
  }
}

async function create(path: string, body: string, label: string): Promise<void> {
  try {
    await writeFile(path, body, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new GateRefusal(`${label} already exists.`, "Read and edit the existing Markdown record.");
    }
    throw error;
  }
}

export async function bundleCreate(root: string, input: {
  id: string; title: string; scope: string; agreed: string;
}): Promise<string> {
  const id = name(input.id, "bundle id");
  const title = line(input.title, "title");
  const scope = required(input.scope, "scope");
  const agreed = line(input.agreed, "agreed");
  const base = inside(root);
  await mkdir(base, { recursive: true });
  const directory = inside(root, id);
  try {
    await mkdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new GateRefusal(`Bundle ${id} already exists.`, `Read changes/active/${id}/ before creating another record.`);
    }
    throw error;
  }
  const path = inside(root, id, "change.md");
  await create(path, [
    `# ${title}`,
    "",
    `Bundle: ${id}`,
    `Agreed: ${agreed}`,
    "",
    "## Delivery scope",
    "",
    scope,
    "",
    "## Decisions and changes to scope",
    "",
    "## Progress and outcome",
    "",
    "## Evidence and references",
    "",
  ].join("\n"), `Bundle ${id}`);
  return `Created changes/active/${id}/change.md. The bundle may contain zero units.`;
}

export async function bundleShow(root: string, idInput: string): Promise<string> {
  const id = name(idInput, "bundle id");
  return read(inside(root, id, "change.md"), `Bundle ${id}`);
}

export async function bundleList(root: string): Promise<string> {
  const entries = await readdir(inside(root), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return names.length ? names.join("\n") : "No bundles in changes/active/.";
}

export async function unitCreate(root: string, input: {
  bundle: string; id: string; title: string; outcome: string; boundary: string; agreed: string;
}): Promise<string> {
  const bundle = name(input.bundle, "bundle id");
  const id = name(input.id, "unit id");
  const title = line(input.title, "title");
  const outcome = required(input.outcome, "outcome");
  const boundary = required(input.boundary, "boundary");
  const agreed = line(input.agreed, "agreed");
  const bundleRecord = await bundleShow(root, bundle);
  if (!bundleRecord.split("\n").includes(`Bundle: ${bundle}`)) {
    throw new GateRefusal(
      `Bundle ${bundle} does not use the new Markdown contract.`,
      "Reconcile the existing bundle before adding a new unit through this command.",
    );
  }
  const directory = inside(root, bundle, "units");
  await mkdir(directory, { recursive: true });
  const path = inside(root, bundle, "units", `${id}.md`);
  await create(path, [
    `# ${title}`,
    "",
    "Status: planned",
    `Unit: ${id}`,
    `Bundle: ${bundle}`,
    `Agreed: ${agreed}`,
    "",
    "## Intended outcome",
    "",
    outcome,
    "",
    "## Boundary",
    "",
    boundary,
    "",
    "## Progress and decisions",
    "",
    "## Completion evidence",
    "",
  ].join("\n"), `Unit ${id}`);
  return `Created changes/active/${bundle}/units/${id}.md.`;
}

export async function unitShow(root: string, bundleInput: string, idInput: string): Promise<string> {
  const bundle = name(bundleInput, "bundle id");
  const id = name(idInput, "unit id");
  return read(inside(root, bundle, "units", `${id}.md`), `Unit ${id} in ${bundle}`);
}

export async function unitList(root: string, bundleInput: string): Promise<string> {
  const bundle = name(bundleInput, "bundle id");
  await bundleShow(root, bundle);
  const entries = await readdir(inside(root, bundle, "units"), { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const names = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -3)).sort();
  return names.length ? names.join("\n") : `Bundle ${bundle} has no units.`;
}

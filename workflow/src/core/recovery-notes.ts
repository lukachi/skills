import { mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { GateRefusal } from "./gates.js";
import { withLock, writeAtomic } from "./lock.js";
import { contains } from "./paths-resolve.js";

const FLOWS = ".workflow/flows";

function name(value: string, label: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value) || value.includes("..")) {
    throw new GateRefusal(`Invalid ${label}: ${value || "(empty)"}.`, `Select a lowercase ${label} explicitly.`);
  }
  return value;
}

function required(value: string, label: string): string {
  if (!value.trim()) throw new GateRefusal(`${label} is required.`, `Provide --${label} "<text>".`);
  return value.trim();
}

function pathFor(root: string, namespaceInput: string, idInput?: string): string {
  const namespace = name(namespaceInput, "namespace");
  const base = resolve(root, FLOWS);
  const path = idInput === undefined
    ? resolve(base, namespace)
    : resolve(base, namespace, `${name(idInput, "recovery id")}.md`);
  if (!contains(base, path)) throw new GateRefusal("Recovery path leaves .workflow/flows.", "Use a local namespace.");
  return path;
}

export async function recoveryCheckpoint(root: string, input: {
  namespace: string;
  id: string;
  instruction: string;
  last: string;
  next: string;
  links: string[];
  blocker?: string;
  checkout?: string;
  revision?: string;
}): Promise<string> {
  const instruction = required(input.instruction, "instruction");
  const last = required(input.last, "last");
  const next = required(input.next, "next");
  const path = pathFor(root, input.namespace, input.id);
  await mkdir(pathFor(root, input.namespace), { recursive: true });
  const body = [
    `# Recovery: ${name(input.id, "recovery id")}`,
    "",
    `Namespace: ${name(input.namespace, "namespace")}`,
    `Updated: ${new Date().toISOString()}`,
    ...(input.checkout ? [`Checkout: ${input.checkout.trim()}`] : []),
    ...(input.revision ? [`Revision: ${input.revision.trim()}`] : []),
    "",
    "## Current instruction",
    "",
    instruction,
    "",
    "## Last completed action",
    "",
    last,
    "",
    "## Next action",
    "",
    next,
    "",
    ...(input.blocker ? ["## Blockers or open questions", "", input.blocker.trim(), ""] : []),
    "## References",
    "",
    ...(input.links.length ? input.links.map((link) => `- ${link.trim()}`) : ["None recorded."]),
    "",
  ].join("\n");
  await withLock(path, () => writeAtomic(path, body));
  return `Updated local recovery note in namespace ${input.namespace}: ${input.id}.`;
}

export async function recoveryHandoff(root: string, namespace: string, id: string): Promise<string> {
  const path = pathFor(root, namespace, id);
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new GateRefusal(`No recovery note ${id} in namespace ${namespace}.`, `wfctl flow list --namespace ${namespace}`);
    }
    throw error;
  }
}

export async function recoveryList(root: string, namespace: string): Promise<string> {
  const directory = pathFor(root, namespace);
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const names = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -3)).sort();
  return names.length ? names.join("\n") : `No recovery notes in namespace ${namespace}.`;
}

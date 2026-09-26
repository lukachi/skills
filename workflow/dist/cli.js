#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name3 in all)
    __defProp(target, name3, { get: all[name3], enumerable: true });
};

// src/core/gates.ts
var GateRefusal;
var init_gates = __esm({
  "src/core/gates.ts"() {
    "use strict";
    GateRefusal = class extends Error {
      constructor(message, remedy, detail) {
        super(message);
        this.remedy = remedy;
        this.detail = detail;
        this.name = "GateRefusal";
        if (!remedy.trim()) {
          throw new Error(`A refusal must name the command that clears it: ${message}`);
        }
      }
      remedy;
      detail;
      render() {
        return [this.message, this.detail, `remedy: ${this.remedy}`].filter((part) => Boolean(part)).join("\n");
      }
    };
  }
});

// src/core/paths-resolve.ts
var paths_resolve_exports = {};
__export(paths_resolve_exports, {
  canonical: () => canonical,
  contains: () => contains,
  findRepositoryRoot: () => findRepositoryRoot
});
import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
function settle(from, trailing) {
  let node = from;
  const rest = [...trailing];
  for (; ; ) {
    try {
      return [realpathSync.native(node), ...rest].join(sep);
    } catch {
      const parent = dirname(node);
      if (parent === node) return [node, ...rest].join(sep);
      rest.unshift(node.slice(parent.length + 1));
      node = parent;
    }
  }
}
function canonical(path) {
  let current = resolve(path);
  const trailing = [];
  for (let depth = 0; depth < MAX_LINKS; depth += 1) {
    try {
      if (lstatSync(current).isSymbolicLink()) {
        const target = readlinkSync(current);
        current = isAbsolute(target) ? target : resolve(dirname(current), target);
        continue;
      }
    } catch {
    }
    return settle(current, trailing);
  }
  return settle(current, trailing);
}
function contains(base, target) {
  const root = canonical(base);
  const path = canonical(target);
  return path === root || path.startsWith(`${root}${sep}`);
}
function findRepositoryRoot(from) {
  let current = canonical(from);
  for (let depth = 0; depth < 32; depth += 1) {
    if (exists(resolve(current, ".workflow/state.json"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return canonical(from);
}
function exists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}
var MAX_LINKS;
var init_paths_resolve = __esm({
  "src/core/paths-resolve.ts"() {
    "use strict";
    MAX_LINKS = 64;
  }
});

// src/core/lock.ts
import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname as dirname2, resolve as resolve2 } from "node:path";
function lockPath(target) {
  return `${resolve2(target)}.lock`;
}
async function readHolderAt(path) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return typeof parsed?.token === "string" ? parsed : void 0;
  } catch {
    return void 0;
  }
}
async function readHolder(target) {
  return readHolderAt(lockPath(target));
}
function isAbandonedHolder(holder) {
  if (Date.now() - holder.at > STALE_AFTER_MS) return true;
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch {
    return true;
  }
}
async function take(target, token) {
  const path = lockPath(target);
  const temporary = `${path}.${process.pid}.${token}.tmp`;
  await writeFile(temporary, JSON.stringify({ pid: process.pid, token, at: Date.now() }), "utf8");
  try {
    await link(temporary, path);
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return false;
  } finally {
    await rm(temporary, { force: true }).catch(() => void 0);
  }
}
async function reclaim(target, judged) {
  const path = lockPath(target);
  const now = await readHolder(target);
  if (judged && (!now || now.token !== judged.token)) return;
  if (!judged && now) return;
  const aside = `${path}.stale.${process.pid}.${Math.random().toString(36).slice(2)}`;
  try {
    await rename(path, aside);
  } catch {
    return;
  }
  const taken = await readHolderAt(aside);
  if (taken && !isAbandonedHolder(taken)) {
    try {
      await rename(aside, path);
      return;
    } catch {
    }
  }
  await rm(aside, { force: true }).catch(() => void 0);
}
async function withLock(target, work) {
  const path = lockPath(target);
  const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + WAIT_MS;
  await mkdir(dirname2(path), { recursive: true });
  for (; ; ) {
    if (await take(target, token)) break;
    const holder = await readHolder(target);
    if (!holder || isAbandonedHolder(holder)) {
      await reclaim(target, holder);
    }
    if (Date.now() > deadline) {
      throw new GateRefusal(
        `${target} is being written by another session.`,
        "Wait for it to finish, then try again.",
        "Two sessions writing one record lose each other's work without either being told."
      );
    }
    await new Promise((wake) => setTimeout(wake, RETRY_MS + Math.floor(Math.random() * RETRY_MS)));
  }
  try {
    return await work();
  } finally {
    const holder = await readHolder(target);
    if (holder?.token === token) {
      await rm(path, { force: true }).catch(() => void 0);
    }
  }
}
async function writeAtomic(path, body) {
  const temporary = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, body, "utf8");
  const { rename: rename2 } = await import("node:fs/promises");
  await rename2(temporary, path);
}
var STALE_AFTER_MS, RETRY_MS, WAIT_MS;
var init_lock = __esm({
  "src/core/lock.ts"() {
    "use strict";
    init_gates();
    STALE_AFTER_MS = 3e4;
    RETRY_MS = 10;
    WAIT_MS = 1e4;
  }
});

// src/core/install.ts
import { createHash } from "node:crypto";
import { mkdir as mkdir2, readFile as readFile2, readdir, rm as rm2, rmdir, stat, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname3, join, relative, resolve as resolve3 } from "node:path";
function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}
async function readIfPresent(path) {
  try {
    return await readFile2(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function collect(root, prefix = "") {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collect(root, rel));
      continue;
    }
    files.push({ path: rel, content: await readFile2(join(root, rel), "utf8") });
  }
  return files;
}
async function readInstallState(target) {
  const raw = await readIfPresent(resolve3(target, ".workflow/state.json"));
  return raw ? JSON.parse(raw) : void 0;
}
async function planInstall(options) {
  const state = await readInstallState(options.target);
  const operations = [];
  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const path = resolve3(options.target, directory);
    const present = await stat(path).then(
      (entry) => entry.isDirectory(),
      () => false
    );
    if (!present) operations.push({ kind: "create-directory", path: directory });
  }
  const installable = [];
  for (const file of await collect(resolve3(options.distribution, "templates/skill/wfctl"))) {
    if (!["SKILL.md", "references/commands.md", "references/tidying.md"].includes(file.path)) continue;
    for (const directory of SKILL_DIRS) {
      installable.push({ path: join(directory, file.path), content: file.content });
    }
  }
  installable.push({
    path: ".workflow/.gitignore",
    content: await readFile2(resolve3(options.distribution, "templates/workflow/gitignore"), "utf8")
  });
  for (const file of installable) {
    const rel = file.path;
    const current = await readIfPresent(resolve3(options.target, rel));
    const next = hash(file.content);
    if (current === void 0) {
      operations.push({ kind: "write", path: rel });
      continue;
    }
    if (hash(current) === next) {
      operations.push({ kind: "skip-unchanged", path: rel });
      continue;
    }
    operations.push({ kind: "write", path: rel });
  }
  const shipped = new Set(installable.map((file) => file.path));
  const obsolete = /* @__PURE__ */ new Set();
  for (const rel of Object.keys(state?.files ?? {})) {
    if (shipped.has(rel)) continue;
    const path = resolve3(options.target, rel);
    if (!contains(options.target, path) || path === resolve3(options.target)) {
      throw new GateRefusal(`Invalid installed file path: ${rel}.`, "Repair .workflow/state.json before updating.");
    }
    if (await readIfPresent(path) === void 0) continue;
    obsolete.add(rel);
  }
  for (const name3 of ["guard-stop.mjs", "guard-write.mjs", "guard-background-bash.mjs", "hook-input.mjs", "idle-guard.sh"]) {
    const rel = join(RUNTIME_DIR, name3);
    if (await readIfPresent(resolve3(options.target, rel)) !== void 0) obsolete.add(rel);
  }
  if (await readIfPresent(resolve3(options.target, ".workflow/guards.json")) !== void 0) {
    obsolete.add(".workflow/guards.json");
  }
  return { target: options.target, operations, obsolete: [...obsolete].sort() };
}
async function applyInstall(plan, options) {
  const result = {
    written: [],
    created: [],
    skipped: [],
    removed: [],
    replacedHooks: []
  };
  const state = await readInstallState(plan.target) ?? {
    schemaVersion: INSTALL_SCHEMA_VERSION,
    installedVersion: options.version,
    files: {}
  };
  state.installedVersion = options.version;
  state.schemaVersion = INSTALL_SCHEMA_VERSION;
  for (const operation of plan.operations) {
    const absolute = resolve3(plan.target, operation.path);
    if (operation.kind === "create-directory") {
      await mkdir2(absolute, { recursive: true });
      result.created.push(operation.path);
      continue;
    }
    if (operation.kind === "skip-unchanged") {
      result.skipped.push(operation.path);
      state.files[operation.path] = { sha256: hash(await readFile2(absolute, "utf8")) };
      continue;
    }
    const skillDir = SKILL_DIRS.find((directory) => operation.path.startsWith(`${directory}/`));
    const source = operation.path === ".workflow/.gitignore" ? resolve3(options.distribution, "templates/workflow/gitignore") : resolve3(
      options.distribution,
      "templates/skill/wfctl",
      relative(skillDir ?? "", operation.path)
    );
    const content = await readFile2(source, "utf8");
    await mkdir2(dirname3(absolute), { recursive: true });
    await writeFile2(absolute, content, "utf8");
    state.files[operation.path] = { sha256: hash(content) };
    result.written.push(operation.path);
  }
  for (const rel of plan.obsolete) {
    const path = resolve3(plan.target, rel);
    if (!contains(plan.target, path) || path === resolve3(plan.target)) {
      throw new GateRefusal(`Refusing to remove ${rel}.`, "Use a path inside the installation target.");
    }
    await rm2(path, { force: true });
    delete state.files[rel];
    result.removed.push(rel);
  }
  const currentFiles = new Set(plan.operations.filter((operation) => operation.kind !== "create-directory").map((operation) => operation.path));
  state.files = Object.fromEntries(Object.entries(state.files).filter(([path]) => currentFiles.has(path)));
  await rmdir(resolve3(plan.target, RUNTIME_DIR)).catch((error) => {
    if (error.code !== "ENOTEMPTY" && error.code !== "ENOENT") throw error;
  });
  await mkdir2(resolve3(plan.target, ".workflow"), { recursive: true });
  await writeFile2(
    resolve3(plan.target, ".workflow/state.json"),
    `${JSON.stringify(state, null, 2)}
`,
    "utf8"
  );
  result.replacedHooks = await installHooks(plan.target);
  await installManagedBlock(plan.target, options.distribution);
  return result;
}
function assertProfileSupported(profile) {
  if (profile === "knowledge") return;
  if (profile === "leaf") {
    throw new GateRefusal(
      "There is no leaf installation any more.",
      "wfctl init knowledge   (run in the knowledge repository)",
      "The agent is bootstrapped in the knowledge repository and edits leaf code from there. Register the repository instead of installing into it."
    );
  }
  throw new GateRefusal(`Unknown profile ${profile}.`, "wfctl init knowledge");
}
async function installHooks(target) {
  if (await readIfPresent(resolve3(target, ".claude/settings.json")) === void 0) return [];
  return withLock(resolve3(target, ".claude/settings.json"), () => installHooksLocked(target));
}
function looksInstalled(command) {
  return /(^|[;&|\s])wfctl\s+(brief(?:\s+--hook)?|hook\s+write)(?=\s|$)/.test(command) || command.includes(`$CLAUDE_PROJECT_DIR/${RUNTIME_DIR}/`);
}
async function installHooksLocked(target) {
  const path = resolve3(target, ".claude/settings.json");
  const existing = await readIfPresent(path);
  let settings = {};
  if (existing) {
    try {
      settings = JSON.parse(existing);
    } catch {
      throw new GateRefusal(
        `${path} is not valid JSON, so its hooks cannot be merged.`,
        "Repair the file, then run init again."
      );
    }
  }
  if (Array.isArray(settings) || typeof settings !== "object" || settings === null) {
    throw new GateRefusal(
      `${path} is not a JSON object, so its hooks cannot be merged.`,
      "Repair the file, then run init again.",
      "Merging into an array would have written the hooks onto a property that JSON.stringify discards, leaving the install reporting success with no hooks at all."
    );
  }
  const existingHooks = settings.hooks;
  if (existingHooks !== void 0 && (typeof existingHooks !== "object" || existingHooks === null || Array.isArray(existingHooks))) {
    throw new GateRefusal(
      `${path} has a "hooks" value that is not an object.`,
      "Repair the file, then run init again."
    );
  }
  const replaced = [];
  const hooks = { ...existingHooks ?? {} };
  for (const [event, value] of Object.entries(hooks)) {
    if (!Array.isArray(value)) continue;
    const remaining2 = [];
    for (const entry of value) {
      const record = entry;
      if (!record || !Array.isArray(record.hooks)) {
        remaining2.push(entry);
        continue;
      }
      const kept = record.hooks.filter((hook) => {
        const command = hook?.command;
        if (typeof command !== "string" || !looksInstalled(command)) return true;
        replaced.push(`${event}: ${command}`);
        return false;
      });
      if (kept.length > 0) remaining2.push({ ...record, hooks: kept });
    }
    if (remaining2.length > 0) hooks[event] = remaining2;
    else delete hooks[event];
  }
  if (replaced.length === 0) return replaced;
  if (Object.keys(hooks).length > 0) settings.hooks = hooks;
  else delete settings.hooks;
  await writeAtomic(path, `${JSON.stringify(settings, null, 2)}
`);
  return replaced;
}
async function installManagedBlock(target, distribution) {
  const body = (await readFile2(resolve3(distribution, "templates/agents/managed.md"), "utf8")).trim();
  const block = `${MANAGED_BEGIN}
${body}
${MANAGED_END}
`;
  const written = /* @__PURE__ */ new Set();
  for (const name3 of ["AGENTS.md", "CLAUDE.md"]) {
    const path = resolve3(target, name3);
    const real = canonical(path);
    if (written.has(real)) continue;
    written.add(real);
    const existing = await readIfPresent(path);
    if (existing === void 0) {
      await writeFile2(path, block, "utf8");
      continue;
    }
    const begin = existing.indexOf(MANAGED_BEGIN);
    const end = existing.indexOf(MANAGED_END);
    const begins = existing.split(MANAGED_BEGIN).length - 1;
    const ends = existing.split(MANAGED_END).length - 1;
    if (begins !== ends || begins > 1 || begins === 1 && end < begin) {
      throw new GateRefusal(
        `${name3} has an unbalanced wfctl marker block.`,
        `Repair the markers in ${name3} so one ${MANAGED_BEGIN} is followed by one ${MANAGED_END}, then run init again.`,
        `Found ${begins} begin marker(s) and ${ends} end marker(s). Writing past that would move the boundary and take your own text with it.`
      );
    }
    if (begin >= 0 && end > begin) {
      const next = existing.slice(0, begin) + block.trimEnd() + existing.slice(end + MANAGED_END.length);
      await writeFile2(path, next, "utf8");
      continue;
    }
    await writeFile2(path, `${existing.trimEnd()}

${block}`, "utf8");
  }
}
var MANAGED_BEGIN, MANAGED_END, INSTALL_SCHEMA_VERSION, RUNTIME_DIR, SKILL_DIRS, KNOWLEDGE_DIRECTORIES;
var init_install = __esm({
  "src/core/install.ts"() {
    "use strict";
    init_gates();
    init_paths_resolve();
    init_lock();
    MANAGED_BEGIN = "<!-- wfctl:begin -->";
    MANAGED_END = "<!-- wfctl:end -->";
    INSTALL_SCHEMA_VERSION = 2;
    RUNTIME_DIR = ".workflow/runtime";
    SKILL_DIRS = [".claude/skills/wfctl", ".agents/skills/wfctl"];
    KNOWLEDGE_DIRECTORIES = [
      "knowledge",
      "changes/active",
      "changes/archive",
      "reconstruction/raw",
      "reconstruction/active",
      "reconstruction/archive",
      "trajectories"
    ];
  }
});

// src/core/voluntary-records.ts
var voluntary_records_exports = {};
__export(voluntary_records_exports, {
  bundleCreate: () => bundleCreate,
  bundleList: () => bundleList,
  bundleShow: () => bundleShow,
  unitCreate: () => unitCreate,
  unitList: () => unitList,
  unitShow: () => unitShow
});
import { mkdir as mkdir3, readFile as readFile3, readdir as readdir2, writeFile as writeFile3 } from "node:fs/promises";
import { resolve as resolve4 } from "node:path";
function name(value, kind) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value) || value.includes("..")) {
    throw new GateRefusal(
      `Invalid ${kind}: ${value || "(empty)"}.`,
      `Use a short lowercase ${kind} with letters, numbers, dots, dashes, or underscores.`
    );
  }
  return value;
}
function required(value, label2) {
  if (!value.trim()) throw new GateRefusal(`${label2} is required.`, `Provide --${label2} "<text>".`);
  return value.trim();
}
function line(value, label2) {
  const text = required(value, label2);
  if (/[\r\n]/.test(text)) throw new GateRefusal(`${label2} must be one line.`, `Provide --${label2} "<text>".`);
  return text;
}
function inside(root, ...parts) {
  const base = resolve4(root, ACTIVE);
  const path = resolve4(base, ...parts);
  if (!contains(base, path)) throw new GateRefusal("Record path leaves changes/active.", "Use a record inside this repository.");
  return path;
}
async function read(path, label2) {
  try {
    return await readFile3(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new GateRefusal(`${label2} does not exist.`, "List records and choose an existing one.");
    }
    throw error;
  }
}
async function create(path, body, label2) {
  try {
    await writeFile3(path, body, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new GateRefusal(`${label2} already exists.`, "Read and edit the existing Markdown record.");
    }
    throw error;
  }
}
async function bundleCreate(root, input) {
  const id = name(input.id, "bundle id");
  const title = line(input.title, "title");
  const scope = required(input.scope, "scope");
  const agreed = line(input.agreed, "agreed");
  const base = inside(root);
  await mkdir3(base, { recursive: true });
  const directory = inside(root, id);
  try {
    await mkdir3(directory);
  } catch (error) {
    if (error.code === "EEXIST") {
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
    ""
  ].join("\n"), `Bundle ${id}`);
  return `Created changes/active/${id}/change.md. The bundle may contain zero units.`;
}
async function bundleShow(root, idInput) {
  const id = name(idInput, "bundle id");
  return read(inside(root, id, "change.md"), `Bundle ${id}`);
}
async function bundleList(root) {
  const entries = await readdir2(inside(root), { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return names.length ? names.join("\n") : "No bundles in changes/active/.";
}
async function unitCreate(root, input) {
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
      "Reconcile the existing bundle before adding a new unit through this command."
    );
  }
  const directory = inside(root, bundle, "units");
  await mkdir3(directory, { recursive: true });
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
    ""
  ].join("\n"), `Unit ${id}`);
  return `Created changes/active/${bundle}/units/${id}.md.`;
}
async function unitShow(root, bundleInput, idInput) {
  const bundle = name(bundleInput, "bundle id");
  const id = name(idInput, "unit id");
  return read(inside(root, bundle, "units", `${id}.md`), `Unit ${id} in ${bundle}`);
}
async function unitList(root, bundleInput) {
  const bundle = name(bundleInput, "bundle id");
  await bundleShow(root, bundle);
  const entries = await readdir2(inside(root, bundle, "units"), { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const names = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name.slice(0, -3)).sort();
  return names.length ? names.join("\n") : `Bundle ${bundle} has no units.`;
}
var ACTIVE;
var init_voluntary_records = __esm({
  "src/core/voluntary-records.ts"() {
    "use strict";
    init_gates();
    init_paths_resolve();
    ACTIVE = "changes/active";
  }
});

// src/core/recovery-notes.ts
var recovery_notes_exports = {};
__export(recovery_notes_exports, {
  recoveryCheckpoint: () => recoveryCheckpoint,
  recoveryHandoff: () => recoveryHandoff,
  recoveryList: () => recoveryList
});
import { mkdir as mkdir4, readFile as readFile4, readdir as readdir3 } from "node:fs/promises";
import { resolve as resolve5 } from "node:path";
function name2(value, label2) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value) || value.includes("..")) {
    throw new GateRefusal(`Invalid ${label2}: ${value || "(empty)"}.`, `Select a lowercase ${label2} explicitly.`);
  }
  return value;
}
function required2(value, label2) {
  if (!value.trim()) throw new GateRefusal(`${label2} is required.`, `Provide --${label2} "<text>".`);
  return value.trim();
}
function pathFor(root, namespaceInput, idInput) {
  const namespace = name2(namespaceInput, "namespace");
  const base = resolve5(root, FLOWS);
  const path = idInput === void 0 ? resolve5(base, namespace) : resolve5(base, namespace, `${name2(idInput, "recovery id")}.md`);
  if (!contains(base, path)) throw new GateRefusal("Recovery path leaves .workflow/flows.", "Use a local namespace.");
  return path;
}
async function recoveryCheckpoint(root, input) {
  const instruction = required2(input.instruction, "instruction");
  const last = required2(input.last, "last");
  const next = required2(input.next, "next");
  const path = pathFor(root, input.namespace, input.id);
  await mkdir4(pathFor(root, input.namespace), { recursive: true });
  const body = [
    `# Recovery: ${name2(input.id, "recovery id")}`,
    "",
    `Namespace: ${name2(input.namespace, "namespace")}`,
    `Updated: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    ...input.checkout ? [`Checkout: ${input.checkout.trim()}`] : [],
    ...input.revision ? [`Revision: ${input.revision.trim()}`] : [],
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
    ...input.blocker ? ["## Blockers or open questions", "", input.blocker.trim(), ""] : [],
    "## References",
    "",
    ...input.links.length ? input.links.map((link2) => `- ${link2.trim()}`) : ["None recorded."],
    ""
  ].join("\n");
  await withLock(path, () => writeAtomic(path, body));
  return `Updated local recovery note in namespace ${input.namespace}: ${input.id}.`;
}
async function recoveryHandoff(root, namespace, id) {
  const path = pathFor(root, namespace, id);
  try {
    return await readFile4(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new GateRefusal(`No recovery note ${id} in namespace ${namespace}.`, `wfctl flow list --namespace ${namespace}`);
    }
    throw error;
  }
}
async function recoveryList(root, namespace) {
  const directory = pathFor(root, namespace);
  const entries = await readdir3(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const names = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name.slice(0, -3)).sort();
  return names.length ? names.join("\n") : `No recovery notes in namespace ${namespace}.`;
}
var FLOWS;
var init_recovery_notes = __esm({
  "src/core/recovery-notes.ts"() {
    "use strict";
    init_gates();
    init_lock();
    init_paths_resolve();
    FLOWS = ".workflow/flows";
  }
});

// src/core/guidance.ts
var guidance_exports = {};
__export(guidance_exports, {
  GUIDE_TOPICS: () => GUIDE_TOPICS,
  compose: () => compose,
  loadGuidance: () => loadGuidance
});
import { readFile as readFile5 } from "node:fs/promises";
import { resolve as resolve6 } from "node:path";
async function loadGuidance(source, key) {
  const path = resolve6(source.root, `${key}.md`);
  try {
    const text = await readFile5(path, "utf8");
    return text.trim().length > 0 ? text.trim() : void 0;
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
function compose(parts) {
  return parts.filter((part) => Boolean(part && part.trim())).join("\n\n");
}
var GUIDE_TOPICS;
var init_guidance = __esm({
  "src/core/guidance.ts"() {
    "use strict";
    GUIDE_TOPICS = {
      interview: "decide/interview",
      "domain-language": "decide/domain-language",
      prototype: "decide/prototype",
      research: "decide/research",
      scope: "reconstruct/scope",
      crawl: "reconstruct/crawl",
      assemble: "reconstruct/assemble",
      adjudicate: "reconstruct/adjudicate",
      probe: "reconstruct/probe",
      sources: "reconstruct/sources"
    };
  }
});

// src/core/registry.ts
var registry_exports = {};
__export(registry_exports, {
  REGISTRY_PATH: () => REGISTRY_PATH,
  addRepository: () => addRepository,
  label: () => label,
  readRegistry: () => readRegistry,
  removeRepository: () => removeRepository,
  renderRegistry: () => renderRegistry,
  writeRegistry: () => writeRegistry
});
import { mkdir as mkdir5, readFile as readFile6, writeFile as writeFile4 } from "node:fs/promises";
import { dirname as dirname4, resolve as resolve7 } from "node:path";
function label(entry) {
  return entry.checkout || entry.worktreeId;
}
async function readRegistry(root) {
  try {
    const raw = await readFile6(resolve7(root, REGISTRY_PATH), "utf8");
    const parsed = JSON.parse(raw);
    return parsed.repositories ?? [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
async function writeRegistry(root, repositories) {
  const path = resolve7(root, REGISTRY_PATH);
  await mkdir5(dirname4(path), { recursive: true });
  await writeFile4(path, `${JSON.stringify({ repositories }, null, 2)}
`, "utf8");
}
async function addRepository(root, entry) {
  for (const [field, value] of Object.entries(entry)) {
    if (!String(value).trim()) {
      throw new GateRefusal(
        `A registered repository needs its ${field}.`,
        "wfctl repo add <owner/name> --path <dir> [--checkout <name>] [--worktree <id>]"
      );
    }
  }
  const existing = await readRegistry(root);
  const duplicate = existing.find(
    (candidate) => candidate.repository === entry.repository && candidate.worktreeId === entry.worktreeId
  );
  if (duplicate) {
    throw new GateRefusal(
      `${entry.repository} worktree ${entry.worktreeId} is already registered at ${duplicate.path}.`,
      `wfctl repo remove ${entry.repository} --worktree ${entry.worktreeId}`,
      "Two checkouts of one repository are distinct only by worktree identity. Registering the same one twice makes the second silently shadow the first."
    );
  }
  const next = [...existing, entry].sort(
    (left, right) => left.repository.localeCompare(right.repository) || left.worktreeId.localeCompare(right.worktreeId)
  );
  await writeRegistry(root, next);
  return next;
}
async function removeRepository(root, repository, worktreeId) {
  const existing = await readRegistry(root);
  const next = existing.filter(
    (entry) => entry.repository !== repository || worktreeId !== void 0 && entry.worktreeId !== worktreeId
  );
  if (next.length === existing.length) {
    throw new GateRefusal(`${repository} is not registered.`, "wfctl repo list");
  }
  await writeRegistry(root, next);
  return next;
}
function renderRegistry(repositories) {
  if (repositories.length === 0) {
    return [
      "No repositories are registered.",
      "",
      "Register each checkout the project keeps, including worktrees:",
      "  wfctl repo add <owner/name> --path <dir> [--worktree <id>]"
    ].join("\n");
  }
  return repositories.map((entry) => `${entry.repository}  ${label(entry).padEnd(14)}  ${entry.path}`).join("\n");
}
var REGISTRY_PATH;
var init_registry = __esm({
  "src/core/registry.ts"() {
    "use strict";
    init_gates();
    REGISTRY_PATH = ".workflow/repositories.json";
  }
});

// src/core/leaves.ts
var leaves_exports = {};
__export(leaves_exports, {
  GRAPH_PATH: () => GRAPH_PATH,
  graphSetup: () => graphSetup,
  inspectLeaf: () => inspectLeaf,
  inspectLeaves: () => inspectLeaves,
  renderLeaves: () => renderLeaves
});
import { stat as stat2 } from "node:fs/promises";
import { resolve as resolve8 } from "node:path";
async function inspectLeaf(entry, now = /* @__PURE__ */ new Date()) {
  const base = {
    repository: entry.repository,
    worktreeId: entry.worktreeId,
    checkout: entry.checkout,
    path: entry.path,
    graph: "unreachable"
  };
  const reachable = await stat2(entry.path).then(
    (found) => found.isDirectory(),
    () => false
  );
  if (!reachable) return base;
  const graph = await stat2(resolve8(entry.path, GRAPH_PATH)).catch(() => void 0);
  if (!graph) return { ...base, graph: "missing" };
  const ageDays = Math.floor((now.getTime() - graph.mtimeMs) / 864e5);
  return { ...base, graph: ageDays > STALE_AFTER_DAYS ? "stale" : "ready", ageDays };
}
async function inspectLeaves(entries, now = /* @__PURE__ */ new Date()) {
  return Promise.all(entries.map((entry) => inspectLeaf(entry, now)));
}
function graphSetup(path) {
  return [
    `No graph in ${path}.`,
    "",
    "Nothing is installed into a source repository, but its structure has to be",
    "readable before anything here can traverse it. In that checkout:",
    "",
    "  uv tool install graphifyy      # once per machine, if the CLI is absent",
    "  graphify build                 # in the leaf, produces graphify-out/",
    "",
    "The maintainer runs the install; the build is yours. Rebuild it when the",
    "source has moved \u2014 a stale graph answers confidently about code that is gone."
  ].join("\n");
}
function renderLeaves(leaves) {
  if (leaves.length === 0) {
    return [
      "No repositories are registered.",
      "",
      "Register each checkout the project keeps, including worktrees:",
      "  wfctl repo add <owner/name> --path <dir> [--worktree <id>]"
    ].join("\n");
  }
  const rows = leaves.map((leaf) => {
    const age = leaf.graph === "ready" || leaf.graph === "stale" ? `${leaf.ageDays}d` : "";
    return `${leaf.graph.padEnd(11)} ${age.padEnd(5)} ${leaf.repository}  ${label(leaf).padEnd(14)}  ${leaf.path}`;
  });
  const needing = leaves.filter((leaf) => leaf.graph === "missing" || leaf.graph === "stale");
  return [
    ...rows,
    ...needing.length > 0 ? [
      "",
      `${needing.length} need a graph built before it can be traversed:`,
      ...needing.map((leaf) => `  graphify build   (in ${leaf.path})`)
    ] : []
  ].join("\n");
}
var GRAPH_PATH, STALE_AFTER_DAYS;
var init_leaves = __esm({
  "src/core/leaves.ts"() {
    "use strict";
    init_registry();
    GRAPH_PATH = "graphify-out/graph.json";
    STALE_AFTER_DAYS = 30;
  }
});

// src/core/git.ts
var git_exports = {};
__export(git_exports, {
  citation: () => citation,
  currentBranch: () => currentBranch,
  filesAt: () => filesAt,
  head: () => head,
  isRepository: () => isRepository,
  readAt: () => readAt,
  resolveRevision: () => resolveRevision
});
import { spawnSync } from "node:child_process";
function isRepository(path, run3 = runGit) {
  return run3(["rev-parse", "--is-inside-work-tree"], path).status === 0;
}
function head(path, run3 = runGit) {
  const revision = run3(["rev-parse", "HEAD"], path);
  if (revision.status !== 0) {
    throw new GateRefusal(
      `${path} is not a Git repository, or has no commits.`,
      `git -C ${path} init && git -C ${path} commit --allow-empty -m "initial"`,
      revision.stderr.trim()
    );
  }
  const status = run3(["status", "--porcelain"], path);
  return { revision: revision.stdout.trim(), dirty: status.stdout.trim().length > 0 };
}
function resolveRevision(path, revision, run3 = runGit) {
  const result = run3(["rev-parse", "--verify", `${revision}^{commit}`], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `${revision} is not a commit in ${path}.`,
      `git -C ${path} log --oneline -5`,
      "A revision nobody can resolve cannot be read at, so nothing recorded against it can be checked later."
    );
  }
  return result.stdout.trim();
}
function filesAt(path, revision, run3 = runGit) {
  const result = run3(["ls-tree", "-r", "--name-only", revision], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `Cannot list ${path} at ${revision}.`,
      `git -C ${path} log --oneline -5`,
      result.stderr.trim()
    );
  }
  return result.stdout.split("\n").filter((line2) => line2.trim().length > 0).sort();
}
function readAt(path, revision, file, run3 = runGit) {
  const result = run3(["show", `${revision}:${file}`], path);
  if (result.status !== 0) {
    throw new GateRefusal(
      `${file} is not in ${path} at ${revision}.`,
      `wfctl reconstruct status`,
      "It may have been added later, or removed before this revision."
    );
  }
  return result.stdout;
}
function citation(repository, revision, file) {
  return `${repository}@${revision.slice(0, 12)}:${file}`;
}
function currentBranch(path, run3 = runGit) {
  const result = run3(["rev-parse", "--abbrev-ref", "HEAD"], path);
  if (result.status !== 0) return "";
  const name3 = result.stdout.trim();
  return name3 === "HEAD" ? "" : name3;
}
var runGit;
var init_git = __esm({
  "src/core/git.ts"() {
    "use strict";
    init_gates();
    runGit = (args, cwd) => {
      const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 3e4
      });
      return {
        status: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? ""
      };
    };
  }
});

// src/core/trajectory.ts
var trajectory_exports = {};
__export(trajectory_exports, {
  AXES: () => AXES,
  TRAJECTORY_DIR: () => TRAJECTORY_DIR,
  appendEvent: () => appendEvent,
  deriveGap: () => deriveGap,
  listTrajectories: () => listTrajectories,
  readTrajectory: () => readTrajectory,
  renderTrajectory: () => renderTrajectory,
  subjectId: () => subjectId,
  trajectoryPath: () => trajectoryPath,
  writeTrajectory: () => writeTrajectory
});
import { createHash as createHash2 } from "node:crypto";
import { mkdir as mkdir6, readFile as readFile7, readdir as readdir4 } from "node:fs/promises";
import { dirname as dirname5, resolve as resolve9 } from "node:path";
function trajectoryPath(root, id) {
  return resolve9(root, TRAJECTORY_DIR, `${id}.json`);
}
async function readTrajectory(root, id) {
  try {
    return JSON.parse(await readFile7(trajectoryPath(root, id), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function writeTrajectory(root, trajectory) {
  const path = trajectoryPath(root, trajectory.id);
  await mkdir6(dirname5(path), { recursive: true });
  await withLock(path, () => writeAtomic(path, `${JSON.stringify({ ...trajectory, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)}
`));
}
async function listTrajectories(root) {
  let entries;
  try {
    entries = await readdir4(resolve9(root, TRAJECTORY_DIR));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const found = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const trajectory = await readTrajectory(root, entry.slice(0, -".json".length));
    if (trajectory) found.push(trajectory);
  }
  return found.sort((left, right) => left.subject.localeCompare(right.subject));
}
function subjectId(subject) {
  const normalized = subject.trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const digest = createHash2("sha256").update(normalized).digest("hex").slice(0, 8);
  return slug ? `${slug}-${digest}` : digest;
}
async function appendEvent(root, subject, event) {
  if (!subject.trim()) {
    throw new GateRefusal(
      "An event needs the subject whose line it belongs to.",
      'wfctl trajectory append --subject "<the product subject>" --summary "<what happened>"'
    );
  }
  if (!event.summary.trim()) {
    throw new GateRefusal(
      "An event needs its summary, in product language.",
      'wfctl trajectory append --subject "<...>" --summary "<what happened>"'
    );
  }
  const id = subjectId(subject);
  return withLock(trajectoryPath(root, id), async () => appendLocked(root, id, subject, event));
}
async function appendLocked(root, id, subject, event) {
  const existing = await readTrajectory(root, id);
  const trajectory = existing ?? {
    id,
    subject: subject.trim(),
    events: [],
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (event.settles && !trajectory.events.some((entry) => entry.id === event.settles)) {
    throw new GateRefusal(
      `${trajectory.subject} has no event ${event.settles}.`,
      `wfctl trajectory show "${trajectory.subject}"`,
      "A delivery settles an intent that was recorded; naming one that was not closes nothing and hides that it closed nothing."
    );
  }
  trajectory.events = [
    ...trajectory.events,
    {
      ...event,
      id: event.id || `E${String(trajectory.events.length + 1).padStart(3, "0")}`,
      at: event.at ?? (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
  const path = trajectoryPath(root, trajectory.id);
  await mkdir6(dirname5(path), { recursive: true });
  await writeAtomic(path, `${JSON.stringify({ ...trajectory, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)}
`);
  return trajectory;
}
function deriveGap(trajectory) {
  const settled = new Set(
    trajectory.events.filter((event) => event.axis === "delivery" && event.settles).map((event) => event.settles)
  );
  const outstanding = (axis) => trajectory.events.filter((event) => event.axis === axis && !settled.has(event.id)).map((event) => event.summary);
  return {
    subject: trajectory.subject,
    delivery: outstanding("intent"),
    direction: outstanding("vision")
  };
}
function renderTrajectory(trajectory) {
  const lines = [`${trajectory.subject}  (${trajectory.id})`, ""];
  const settled = new Set(
    trajectory.events.filter((event) => event.settles).map((event) => event.settles)
  );
  for (const event of trajectory.events) {
    const when = event.at ? `${event.at.slice(0, 10)}  ` : "";
    const from = event.change ? `  \u2190 ${event.change}` : "";
    const mark = settled.has(event.id) ? " \u2713" : "";
    const closes = event.settles ? `  settles ${event.settles}` : "";
    lines.push(`  ${event.id}  ${event.axis.padEnd(8)} ${when}${event.summary}${from}${closes}${mark}`);
  }
  const gap = deriveGap(trajectory);
  if (gap.delivery.length > 0) {
    lines.push("", "  not delivered:");
    for (const item of gap.delivery) lines.push(`    ${item}`);
  }
  if (gap.direction.length > 0) {
    lines.push("", "  direction not reached:");
    for (const item of gap.direction) lines.push(`    ${item}`);
  }
  return lines.join("\n");
}
var TRAJECTORY_DIR, AXES;
var init_trajectory = __esm({
  "src/core/trajectory.ts"() {
    "use strict";
    init_gates();
    init_lock();
    TRAJECTORY_DIR = "trajectories";
    AXES = ["intent", "delivery", "vision"];
  }
});

// src/core/curated.ts
var curated_exports = {};
__export(curated_exports, {
  KNOWLEDGE_DIR: () => KNOWLEDGE_DIR,
  collectPages: () => collectPages,
  contentHash: () => contentHash,
  inspectLinks: () => inspectLinks,
  inspectPage: () => inspectPage,
  normalizePage: () => normalizePage,
  renderIssues: () => renderIssues,
  stripSeal: () => stripSeal,
  validateCurated: () => validateCurated
});
import { createHash as createHash3 } from "node:crypto";
import { readFile as readFile8, readdir as readdir5 } from "node:fs/promises";
import { join as join2, relative as relative2, resolve as resolve10 } from "node:path";
function contentHash(body) {
  return createHash3("sha256").update(body.trim()).digest("hex");
}
function frontmatter(body) {
  const match = /^---\n([\s\S]*?)\n---/.exec(body);
  if (!match) return {};
  const fields = {};
  const lines = (match[1] ?? "").split("\n");
  for (const [index, raw] of lines.entries()) {
    const pair = /^([a-z_-]+):\s*(.*)$/.exec(raw);
    if (!pair?.[1]) continue;
    const inline = (pair[2] ?? "").replace(/^["']|["']$/g, "").trim();
    if (inline) {
      fields[pair[1]] = inline;
      continue;
    }
    const following = lines[index + 1] ?? "";
    fields[pair[1]] = /^\s+\S/.test(following) ? following.trim().replace(/^-\s*/, "") : "";
  }
  return fields;
}
function isMap(path) {
  const name3 = path.split("/").pop() ?? "";
  return name3 === "index.md" || name3 === "log.md";
}
function inspectPage(path, body) {
  const issues = [];
  const fields = frontmatter(body);
  if (!isMap(path)) {
    for (const required3 of ["view", "purpose", "audience"]) {
      if (!fields[required3]) {
        issues.push({
          path,
          problem: `no ${required3} declared`,
          remedy: `Add ${required3}: to the frontmatter`
        });
      }
    }
  }
  const view = fields.view;
  if (view && !VIEWS.has(view)) {
    issues.push({
      path,
      problem: `view is ${view}; a page is on the product road, the engineering road, or is a decision serving both`,
      remedy: "Set view: product, view: engineering, or view: decision"
    });
  }
  const cited = UNTRUSTED.find((untrusted) => body.includes(untrusted));
  if (cited) {
    {
      issues.push({
        path,
        problem: `cites ${cited}, which carries no authority`,
        remedy: "Cite the evidence itself \u2014 a pinned source location, a promoted decision, or the maintainer's own answer"
      });
    }
  }
  if (view === "product") {
    if (/```[a-z]*\n/.test(body)) {
      issues.push({
        path,
        problem: "carries a code block",
        remedy: "Move it to the engineering page and link that"
      });
    }
    if (/\b(src|lib|packages)\/[\w./-]+\.[a-z]{2,4}\b/.test(body)) {
      issues.push({
        path,
        problem: "names a source path",
        remedy: "Move it to the engineering page and link that"
      });
    }
  }
  if (!/^#\s+\S/m.test(body.replace(/^---[\s\S]*?---/, ""))) {
    issues.push({ path, problem: "has no heading", remedy: "Give the page a title" });
  }
  const stable = fields.status === "stable";
  if (stable && !fields.content_hash) {
    issues.push({
      path,
      problem: "is stable with no sealed content hash",
      remedy: "Seal the review against this page's hash, or set status: draft"
    });
  }
  if (stable && fields.content_hash && fields.content_hash !== contentHash(stripSeal(body))) {
    issues.push({
      path,
      problem: "changed after its review was sealed",
      remedy: "Review it again and reseal, or set status: draft"
    });
  }
  return issues;
}
function stripSeal(body) {
  return body.replace(/^content_hash:.*\n/m, "");
}
async function collectPages(root) {
  const base = resolve10(root, KNOWLEDGE_DIR);
  try {
    const entries = await readdir5(base, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => relative2(base, join2(entry.parentPath ?? base, entry.name))).sort();
  } catch {
    return [];
  }
}
async function inspectLinks(root) {
  const pages = await collectPages(root);
  if (pages.length === 0) return [];
  const known = new Set(pages);
  const linkedTo = /* @__PURE__ */ new Set();
  const issues = [];
  for (const page of pages) {
    const body = await readFile8(resolve10(root, KNOWLEDGE_DIR, page), "utf8").catch(() => "");
    for (const match of body.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      const href = match[1] ?? "";
      if (/^[a-z]+:\/\//.test(href)) continue;
      const target = relative2(
        resolve10(root, KNOWLEDGE_DIR),
        resolve10(root, KNOWLEDGE_DIR, page, "..", href)
      );
      if (!known.has(target)) {
        issues.push({
          path: page,
          problem: `links to ${href}, which is not a curated page`,
          remedy: "Repair the link, or write the page it expects"
        });
        continue;
      }
      linkedTo.add(target);
    }
  }
  for (const page of pages) {
    if (page === "index.md" || linkedTo.has(page)) continue;
    issues.push({
      path: page,
      problem: "nothing links to it",
      remedy: "Link it from its Area index, or from the page that owns the subject"
    });
  }
  return issues;
}
function normalizePage(root, page) {
  const base = resolve10(root, KNOWLEDGE_DIR);
  const absolute = resolve10(root, page);
  const inside2 = relative2(base, absolute);
  if (!inside2.startsWith("..") && inside2 !== "") return inside2;
  const fromRoot = relative2(base, resolve10(base, page));
  if (!fromRoot.startsWith("..") && fromRoot !== "") return fromRoot;
  throw new GateRefusal(
    `${page} is not a curated page.`,
    "wfctl knowledge validate",
    `Curated pages live under ${KNOWLEDGE_DIR}/. This path resolves outside it.`
  );
}
async function validateCurated(root, only) {
  const pages = only ? [normalizePage(root, only)] : await collectPages(root);
  const issues = [];
  for (const page of pages) {
    const body = await readFile8(resolve10(root, KNOWLEDGE_DIR, page), "utf8").catch(() => void 0);
    if (body === void 0) {
      issues.push({ path: page, problem: "cannot be read", remedy: "Check the path" });
      continue;
    }
    issues.push(...inspectPage(page, body));
  }
  if (!only) issues.push(...await inspectLinks(root));
  return issues;
}
function renderIssues(issues, pages = 1) {
  if (pages === 0) {
    return [
      "There are no curated pages.",
      "",
      "That is not a pass. An empty corpus satisfies every structural check, and",
      "reporting it as clean reads exactly like a corpus that was checked."
    ].join("\n");
  }
  if (issues.length === 0) return `${pages} page(s) pass structural validation.`;
  return [
    ...issues.map((issue) => `${issue.path}
  ${issue.problem}
  \u2192 ${issue.remedy}`),
    "",
    `${issues.length} problem(s). Structural validation cannot tell whether a page`,
    "is true or whether a reader can act on it \u2014 that requires human judgment."
  ].join("\n");
}
var KNOWLEDGE_DIR, UNTRUSTED, VIEWS;
var init_curated = __esm({
  "src/core/curated.ts"() {
    "use strict";
    init_gates();
    KNOWLEDGE_DIR = "knowledge";
    UNTRUSTED = ["reconstruction/raw/", "reconstruction/active/", "intake/", "raw/"];
    VIEWS = /* @__PURE__ */ new Set(["product", "engineering", "decision"]);
  }
});

// src/core/reconstruct.ts
var reconstruct_exports = {};
__export(reconstruct_exports, {
  RAW_DIR: () => RAW_DIR,
  RECONSTRUCTION_ARCHIVE: () => RECONSTRUCTION_ARCHIVE,
  RECONSTRUCTION_DIR: () => RECONSTRUCTION_DIR,
  STAGES: () => STAGES,
  STAGE_PRESENCE: () => STAGE_PRESENCE,
  advanceStage: () => advanceStage,
  assertAdjudicated: () => assertAdjudicated,
  assertClosable: () => assertClosable,
  assertCrawlComplete: () => assertCrawlComplete,
  assertPagesWritten: () => assertPagesWritten,
  assertProbed: () => assertProbed,
  assertSomethingRead: () => assertSomethingRead,
  assertTrajectoriesExist: () => assertTrajectoriesExist,
  casePath: () => casePath,
  closeCase: () => closeCase,
  currentCase: () => currentCase,
  hasBaseline: () => hasBaseline,
  lastContradictionId: () => lastContradictionId,
  markExcluded: () => markExcluded,
  markRead: () => markRead,
  mutateCase: () => mutateCase,
  nextStage: () => nextStage,
  rawInventory: () => rawInventory,
  readCase: () => readCase,
  recordContradiction: () => recordContradiction,
  recordProbe: () => recordProbe,
  recordScope: () => recordScope,
  remaining: () => remaining,
  renderOutcome: () => renderOutcome,
  renderStatus: () => renderStatus,
  resolveContradiction: () => resolveContradiction,
  setCurrentCase: () => setCurrentCase,
  writeCase: () => writeCase
});
import { mkdir as mkdir7, readFile as readFile9, readdir as readdir6, stat as stat3 } from "node:fs/promises";
import { dirname as dirname6, join as join3, resolve as resolve11 } from "node:path";
function casePath(root, id) {
  return resolve11(root, RECONSTRUCTION_DIR, id, "case.json");
}
async function readCase(root, id) {
  try {
    return JSON.parse(await readFile9(casePath(root, id), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function writeCase(root, record) {
  const path = casePath(root, record.id);
  await mkdir7(dirname6(path), { recursive: true });
  await withLock(path, () => writeAtomic(path, `${JSON.stringify(record, null, 2)}
`));
}
async function mutateCase(root, id, change) {
  const path = casePath(root, id);
  return withLock(path, async () => {
    const current = await readCase(root, id);
    if (!current) {
      throw new GateRefusal(`No reconstruction named ${id}.`, "wfctl reconstruct status");
    }
    const next = change(current);
    await writeAtomic(path, `${JSON.stringify(next, null, 2)}
`);
    return next;
  });
}
async function hasBaseline(root) {
  const knowledge = resolve11(root, "knowledge");
  try {
    const entries = await readdir6(knowledge, { recursive: true, withFileTypes: true });
    return entries.some((entry) => {
      if (!entry.isFile() || !entry.name.endsWith(".md")) return false;
      const parent = entry.parentPath ?? knowledge;
      return !(parent === knowledge && entry.name === "index.md");
    });
  } catch {
    return false;
  }
}
async function rawInventory(root) {
  const raw = resolve11(root, RAW_DIR);
  try {
    const entries = await readdir6(raw, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => join3(entry.parentPath ?? raw, entry.name).slice(raw.length + 1)).sort();
  } catch {
    return [];
  }
}
function nextStage(stage) {
  const index = STAGES.indexOf(stage);
  return index >= 0 ? STAGES[index + 1] : void 0;
}
function remaining(coverage) {
  const done = /* @__PURE__ */ new Set([...coverage.read, ...coverage.excluded.map((entry) => entry.path)]);
  return coverage.inScope.filter((path) => !done.has(path));
}
function assertSomethingRead(record) {
  if (record.coverage.read.length > 0) return;
  throw new GateRefusal(
    "Nothing in scope was read; every file was excluded.",
    "wfctl reconstruct read <path>",
    "A pass that excluded its whole scope has established nothing about the project, and closing it would record that it had."
  );
}
function assertCrawlComplete(record) {
  const left = remaining(record.coverage);
  if (left.length === 0) return;
  throw new GateRefusal(
    `${left.length} file(s) in scope are neither read nor excluded.`,
    'wfctl reconstruct read <path>   (or: wfctl reconstruct exclude <path> --reason "<why>")',
    left.slice(0, 10).join("\n  ")
  );
}
function assertTrajectoriesExist(record) {
  if (record.trajectories.length > 0) return;
  throw new GateRefusal(
    "No trajectory has been assembled, so nothing can be written yet.",
    "wfctl reconstruct subject <trajectory-id>   (append the events first with wfctl trajectory append)",
    "A claim about current truth made while reading is made before the material that contradicts it has been read."
  );
}
function assertAdjudicated(record) {
  const open = record.contradictions.filter((entry) => !entry.resolution?.trim());
  if (open.length === 0) return;
  throw new GateRefusal(
    `${open.length} contradiction(s) are unresolved.`,
    'wfctl reconstruct resolve <id> --resolution "<what they decided>"',
    open.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")
  );
}
function assertProbed(record, actor) {
  if (record.probes.length === 0) {
    throw new GateRefusal(
      "No omission probe has been run.",
      'wfctl reconstruct probe --question "<answerable only from the pages>" --page <path>',
      "A probe asks whether the written pages can answer without reopening the source. It is what catches material that was fetched and never read."
    );
  }
  const mine = record.probes.filter((probe) => probe.asker === actor);
  if (mine.length > 0) {
    throw new GateRefusal(
      "The probes were asked by the agent that wrote the pages.",
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <a different agent>',
      "Asking yourself what you might have missed returns what you already know."
    );
  }
  const failed = record.probes.filter((probe) => probe.passed !== true);
  if (failed.length > 0) {
    throw new GateRefusal(
      `${failed.length} probe(s) did not pass.`,
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <agent> --passed   (after repairing the page)',
      failed.map((probe) => `  ${probe.question}`).join("\n")
    );
  }
}
function renderOutcome(record) {
  if (record.abandoned) {
    return `Abandoned: ${record.abandoned.reason}`;
  }
  if (record.trajectories.length > 0) {
    return `${record.trajectories.length} subject(s) recorded.`;
  }
  const revisions = record.repositories.map((entry) => `${entry.repository}@${entry.revision}${entry.dirty ? " (dirty)" : ""}`).join(", ");
  return `Nothing moved. Checked at ${revisions}.`;
}
function assertClosable(record, actor) {
  if (record.abandoned) return;
  if (record.stage !== "promote") {
    throw new GateRefusal(
      `This case is at ${record.stage}; closing needs it at promote.`,
      "wfctl reconstruct stage",
      "Each stage's gate runs on the way past it. Closing early runs none of them."
    );
  }
  assertCrawlComplete(record);
  assertTrajectoriesExist(record);
  assertAdjudicated(record);
  assertProbed(record, actor);
}
async function closeCase(root, id) {
  const from = resolve11(root, RECONSTRUCTION_DIR, id);
  const present = await stat3(from).then(
    (entry) => entry.isDirectory(),
    () => false
  );
  if (!present) {
    throw new GateRefusal(`No active reconstruction named ${id}.`, "wfctl reconstruct status");
  }
  const { rename: rename2, rm: rm3, stat: statPath } = await import("node:fs/promises");
  await mkdir7(resolve11(root, RECONSTRUCTION_ARCHIVE), { recursive: true });
  let to = resolve11(root, RECONSTRUCTION_ARCHIVE, id);
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const taken = await statPath(to).then(
      () => true,
      () => false
    );
    if (!taken) break;
    to = resolve11(root, RECONSTRUCTION_ARCHIVE, `${id}-${suffix}`);
  }
  await rename2(from, to);
  await rm3(resolve11(root, RECONSTRUCTION_DIR, "current"), { force: true });
  return to;
}
async function setCurrentCase(root, id) {
  const path = resolve11(root, CURRENT_POINTER);
  await mkdir7(dirname6(path), { recursive: true });
  await writeAtomic(path, `${id}
`);
}
async function currentCase(root) {
  try {
    const id = (await readFile9(resolve11(root, CURRENT_POINTER), "utf8")).trim();
    return id ? readCase(root, id) : void 0;
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function recordScope(root, record, options) {
  if (record.stage !== "scope") {
    throw new GateRefusal(
      `The scope was settled when this case entered ${record.stage}.`,
      "wfctl reconstruct status",
      "Widening it now would move the boundary the coverage gate measures against."
    );
  }
  if (options.repositories.length === 0) {
    throw new GateRefusal(
      "A scope with no repositories reads nothing.",
      "wfctl reconstruct scope --repository <owner/name> --revision <sha>"
    );
  }
  const allRaw = record.rawPaths.map((path) => `${RAW_DIR}/${path}`);
  let raw = [];
  if (options.rawScope === "all") {
    raw = allRaw;
  } else if (options.rawScope === "selected") {
    const chosen = options.inScope ?? [];
    if (chosen.length === 0) {
      throw new GateRefusal(
        "`--raw selected` names which raw material is in scope, and nothing named it.",
        'wfctl reconstruct scope --repository <owner/name> --raw selected --in "<path>"...',
        "Selecting nothing is `--raw none`, and saying so leaves a record that is true. A case that reports raw as selected while no raw path is in scope reads as coverage that was checked."
      );
    }
    raw = allRaw.filter(
      (path) => chosen.some((prefix) => path === prefix || path.startsWith(`${prefix.replace(/\/+$/, "")}/`))
    );
  }
  const fromTree = options.repositories.flatMap((repository) => {
    const revision = resolveRevision(repository.path, repository.revision);
    return filesAt(repository.path, revision).map(
      (file) => `${repository.repository}:${file}`
    );
  });
  const narrowed = options.inScope.length > 0 ? fromTree.filter(
    (entry) => options.inScope.some(
      (want) => entry === want || entry.endsWith(`:${want}`) || entry.includes(`:${want}`)
    )
  ) : fromTree;
  if (options.inScope.length > 0 && narrowed.length === 0) {
    throw new GateRefusal(
      "Nothing in the pinned tree matches that scope.",
      "wfctl reconstruct scope --repository <owner/name> --revision <sha>   (with no --in, for everything)",
      `Asked for: ${options.inScope.join(", ")}`
    );
  }
  const inScope = [.../* @__PURE__ */ new Set([...narrowed, ...raw])].sort();
  const excluded = (options.exclude ?? []).map((path) => {
    if (!inScope.includes(path)) {
      throw new GateRefusal(
        `${path} is not in the pinned tree, so excluding it counts nothing.`,
        "wfctl reconstruct scope --repository <owner/name>"
      );
    }
    return { path, reason: "excluded when the scope was settled" };
  });
  const next = {
    ...record,
    stage: "crawl",
    repositories: options.repositories,
    rawScope: options.rawScope,
    coverage: { ...record.coverage, inScope, excluded }
  };
  await writeCase(root, next);
  return next;
}
async function markRead(root, record, path) {
  if (!record.coverage.inScope.includes(path)) {
    throw new GateRefusal(
      `${path} is not in this case's scope.`,
      "wfctl reconstruct scope --repository <owner/name> --revision <sha> --in <every path, including the ones already listed>",
      "Reading outside the agreed scope is how a bounded pass becomes an unbounded one."
    );
  }
  return mutateCase(root, record.id, (current) => ({
    ...current,
    coverage: {
      ...current.coverage,
      // A path cannot be both read and excluded; the later act wins.
      read: [.../* @__PURE__ */ new Set([...current.coverage.read, path])].sort(),
      excluded: current.coverage.excluded.filter((entry) => entry.path !== path)
    }
  }));
}
async function markExcluded(root, record, path, reason) {
  if (!record.coverage.inScope.includes(path)) {
    throw new GateRefusal(
      `${path} is not in this case's scope, so excluding it counts nothing.`,
      "wfctl reconstruct status",
      "Coverage counted exclusions of paths that were never in scope, which made the remaining figure smaller than the work left."
    );
  }
  if (!reason.trim()) {
    throw new GateRefusal(
      "An exclusion needs its reason.",
      'wfctl reconstruct exclude <path> --reason "<why this cannot inform the baseline>"',
      "An unexplained exclusion is indistinguishable from a file nobody got to."
    );
  }
  return mutateCase(root, record.id, (current) => ({
    ...current,
    coverage: {
      ...current.coverage,
      read: current.coverage.read.filter((entry) => entry !== path),
      excluded: [
        ...current.coverage.excluded.filter((entry) => entry.path !== path),
        { path, reason: reason.trim() }
      ]
    }
  }));
}
async function recordContradiction(root, record, options) {
  if (options.sides.length < 2) {
    throw new GateRefusal(
      "A contradiction needs at least two sides.",
      'wfctl reconstruct contradiction --subject "<...>" --side "<...>" --side "<...>"'
    );
  }
  let created = "";
  return mutateCase(root, record.id, (current) => {
    const id = `C${String(current.contradictions.length + 1).padStart(3, "0")}`;
    created = id;
    return {
      ...current,
      contradictions: [
        ...current.contradictions,
        { id, subject: options.subject, sides: options.sides }
      ]
    };
  }).then((next) => {
    lastContradictionId = created;
    return next;
  });
}
async function resolveContradiction(root, record, id, resolution) {
  const found = record.contradictions.find((entry) => entry.id.toUpperCase() === id.toUpperCase());
  if (!found) {
    throw new GateRefusal(
      `No contradiction named ${id}.`,
      "wfctl reconstruct status",
      record.contradictions.length > 0 ? `Recorded:
${record.contradictions.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}` : "None recorded."
    );
  }
  if (!resolution.trim()) {
    throw new GateRefusal(
      "A resolution records what they decided.",
      `wfctl reconstruct resolve ${id} --resolution "<what they decided>"`
    );
  }
  return mutateCase(root, record.id, (current) => ({
    ...current,
    contradictions: current.contradictions.map(
      (entry) => entry.id.toUpperCase() === id.toUpperCase() ? { ...entry, resolution: resolution.trim() } : entry
    )
  }));
}
async function recordProbe(root, record, probe, actor) {
  if (!probe.question.trim()) {
    throw new GateRefusal(
      "A probe needs its question.",
      'wfctl reconstruct probe --question "<answerable only from the pages>" --asker <agent id>'
    );
  }
  if (!probe.asker.trim() || probe.asker === actor) {
    throw new GateRefusal(
      "A probe needs an asker who did not write the pages.",
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <a different agent>',
      "Asking yourself what you might have missed returns what you already know."
    );
  }
  if (probe.pages.length === 0) {
    throw new GateRefusal(
      "A probe names the pages that must answer it.",
      'wfctl reconstruct probe --question "<...>" --page <path> --asker <agent>'
    );
  }
  const { collectPages: collectPages2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
  const curated = new Set(await collectPages2(root));
  for (const page of probe.pages) {
    const named = page.replace(/^knowledge\//, "");
    if (curated.has(named)) continue;
    throw new GateRefusal(
      `${page} is not a curated page.`,
      "wfctl knowledge validate",
      curated.size > 0 ? `Pages in the corpus:
${[...curated].map((entry) => `  ${entry}`).join("\n")}` : "The corpus is empty; the write stage has not produced anything yet."
    );
  }
  return mutateCase(root, record.id, (current) => ({
    ...current,
    probes: [...current.probes.filter((entry) => entry.question !== probe.question), probe]
  }));
}
async function assertPagesWritten(root, record) {
  const { collectPages: collectPages2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
  const pages = await collectPages2(root);
  if (pages.length > 0) return;
  throw new GateRefusal(
    "No page has been written, so there is nothing to probe.",
    "Write the pages this pass established into knowledge/, then: wfctl reconstruct stage",
    `${record.trajectories.length} subject(s) were assembled. A pass that assembled lines and wrote nothing has established nothing anyone can read.`
  );
}
async function advanceStage(root, record, actor) {
  switch (record.stage) {
    case "scope":
      if (record.repositories.length === 0 || record.coverage.inScope.length === 0) {
        throw new GateRefusal(
          "The scope has not been settled, so there is nothing to read.",
          "wfctl reconstruct scope --repository <owner/name>",
          "A crawl over an empty scope satisfies its own gate without reading anything."
        );
      }
      break;
    case "crawl":
      assertCrawlComplete(record);
      assertSomethingRead(record);
      break;
    case "assemble":
      assertTrajectoriesExist(record);
      break;
    case "adjudicate":
      assertAdjudicated(record);
      break;
    case "write":
      await assertPagesWritten(root, record);
      break;
    case "probe":
      assertProbed(record, actor);
      break;
    default:
      break;
  }
  const following = nextStage(record.stage);
  if (!following) {
    throw new GateRefusal("This case is at its last stage.", `wfctl reconstruct close ${record.id}`);
  }
  const next = { ...record, stage: following };
  await writeCase(root, next);
  return { record: next, stage: following };
}
function renderStatus(record) {
  const left = remaining(record.coverage);
  const open = record.contradictions.filter((entry) => !entry.resolution?.trim());
  const pinned = record.repositories.map((entry) => `${entry.repository}@${entry.revision.slice(0, 12)}${entry.dirty ? " (dirty)" : ""}`).join(", ");
  return [
    record.abandoned ? `${record.id}  \xB7  ABANDONED: ${record.abandoned.reason}` : `${record.id}  \xB7  stage ${record.stage}  \xB7  ${STAGE_PRESENCE[record.stage]} present`,
    // Provenance was recorded and never shown, so every pass closed without
    // naming the revision or the dirtiness it read at.
    ...pinned ? [`read at: ${pinned}`, `raw scope: ${record.rawScope ?? "none"}`] : [],
    record.hadBaseline ? "re-checking an existing baseline" : "first baseline; curated knowledge was empty",
    "",
    `coverage: ${record.coverage.read.length} read, ${record.coverage.excluded.length} excluded, ${left.length} left`,
    `subjects:  ${record.trajectories.length}`,
    open.length > 0 ? `open contradictions:
${open.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}` : "open contradictions: none",
    `probes: ${record.probes.filter((probe) => probe.passed === true).length}/${record.probes.length} passed`
  ].join("\n");
}
var RECONSTRUCTION_DIR, RECONSTRUCTION_ARCHIVE, RAW_DIR, STAGES, STAGE_PRESENCE, CURRENT_POINTER, lastContradictionId;
var init_reconstruct = __esm({
  "src/core/reconstruct.ts"() {
    "use strict";
    init_gates();
    init_git();
    init_lock();
    RECONSTRUCTION_DIR = "reconstruction/active";
    RECONSTRUCTION_ARCHIVE = "reconstruction/archive";
    RAW_DIR = "reconstruction/raw";
    STAGES = [
      "scope",
      "crawl",
      "assemble",
      "adjudicate",
      "write",
      "probe",
      "promote"
    ];
    STAGE_PRESENCE = {
      scope: "maintainer",
      crawl: "nobody",
      assemble: "nobody",
      adjudicate: "maintainer",
      write: "nobody",
      probe: "nobody",
      promote: "maintainer"
    };
    CURRENT_POINTER = "reconstruction/active/current";
    lastContradictionId = "";
  }
});

// src/core/decided.ts
var decided_exports = {};
__export(decided_exports, {
  findDecisions: () => findDecisions,
  renderDecisions: () => renderDecisions
});
import { readFile as readFile10, readdir as readdir7 } from "node:fs/promises";
import { join as join4, relative as relative3, resolve as resolve12 } from "node:path";
function terms(subject) {
  const words = subject.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 0);
  const meaningful = words.filter((term) => !FILLER.has(term));
  return meaningful.length > 0 ? meaningful : words;
}
function score(body, want) {
  const text = body.toLowerCase();
  return want.filter((term) => text.includes(term)).length;
}
function excerpt(body, want) {
  const lines = body.split("\n").filter((line2) => line2.trim().length > 0);
  const best = lines.map((line2) => ({ line: line2.trim(), hits: score(line2, want) })).filter((entry) => entry.hits > 0).sort((left, right) => right.hits - left.hits)[0];
  return best?.line.replace(/^[-*#>|\s]+/, "").slice(0, 300) ?? "";
}
async function adjudications(root) {
  const { RECONSTRUCTION_ARCHIVE: RECONSTRUCTION_ARCHIVE2, RECONSTRUCTION_DIR: RECONSTRUCTION_DIR2 } = await Promise.resolve().then(() => (init_reconstruct(), reconstruct_exports));
  const out = [];
  for (const dir of [RECONSTRUCTION_DIR2, RECONSTRUCTION_ARCHIVE2]) {
    let cases = [];
    try {
      cases = (await readdir7(resolve12(root, dir), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      continue;
    }
    for (const id of cases) {
      const path = join4(dir, id, "case.json");
      let record;
      try {
        record = JSON.parse(await readFile10(resolve12(root, path), "utf8"));
      } catch {
        continue;
      }
      const contradictions = Array.isArray(record.contradictions) ? record.contradictions : [];
      for (const entry of contradictions) {
        const resolution = entry.resolution?.trim();
        if (!resolution) continue;
        out.push({
          subject: entry.subject ?? "",
          resolution,
          path,
          ...record.startedAt ? { at: record.startedAt.slice(0, 10) } : {}
        });
      }
    }
  }
  return out;
}
async function walk(root, dir) {
  const base = resolve12(root, dir);
  try {
    const entries = await readdir7(base, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => relative3(root, join4(entry.parentPath ?? base, entry.name)));
  } catch {
    return [];
  }
}
async function findDecisions(root, subject) {
  const want = terms(subject);
  if (want.length === 0) return [];
  const found = [];
  for (const lane of LANES) {
    for (const path of await walk(root, lane.dir)) {
      const body = await readFile10(resolve12(root, path), "utf8").catch(() => "");
      if (score(body, want) < Math.min(2, want.length)) continue;
      const said = excerpt(body, want);
      if (!said) continue;
      const at = /\b(20\d{2}-\d{2}-\d{2})/.exec(body)?.[1];
      found.push({ where: lane.label, said, path, ...at ? { at } : {} });
    }
  }
  for (const adjudication of await adjudications(root)) {
    if (score(`${adjudication.subject} ${adjudication.resolution}`, want) === 0) continue;
    found.push({
      where: "an adjudicated contradiction",
      said: adjudication.resolution,
      path: adjudication.path,
      ...adjudication.at ? { at: adjudication.at } : {}
    });
  }
  for (const trajectory of await listTrajectories(root)) {
    if (score(trajectory.subject, want) === 0) continue;
    for (const event of trajectory.events.filter((entry) => entry.axis === "vision")) {
      found.push({
        where: "a declared direction",
        said: event.summary,
        path: `trajectories/${trajectory.id}.json`,
        ...event.at ? { at: event.at.slice(0, 10) } : {}
      });
    }
  }
  return found;
}
function renderDecisions(subject, decisions) {
  if (decisions.length === 0) {
    return [
      `Nothing recorded about "${subject}".`,
      "",
      "That is a real answer: it means nobody has settled this, so it is a",
      "question worth their turn. Say so when you ask, rather than asking as",
      "though you had not looked."
    ].join("\n");
  }
  return [
    `${decisions.length} place(s) already say something about "${subject}":`,
    "",
    ...decisions.map(
      (decision) => [
        `${decision.at ?? "undated"}  ${decision.where}`,
        `  "${decision.said}"`,
        `  ${decision.path}`
      ].join("\n")
    ),
    "",
    "Cite the promoted page where there is one and the record where there is not,",
    "and say which. Asking again spends their turn on your bookkeeping."
  ].join("\n");
}
var LANES, FILLER;
var init_decided = __esm({
  "src/core/decided.ts"() {
    "use strict";
    init_trajectory();
    LANES = [
      { dir: "knowledge", label: "a curated page" },
      { dir: "changes/active", label: "an open record" },
      { dir: "changes/promotion", label: "a record awaiting promotion" },
      { dir: "changes/archive", label: "a closed record" },
      { dir: "changes/inbox", label: "a capture" }
    ];
    FILLER = /* @__PURE__ */ new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "of",
      "for",
      "to",
      "in",
      "on",
      "is",
      "it",
      "we",
      "our",
      "be",
      "do",
      "does",
      "how",
      "what",
      "why",
      "should"
    ]);
  }
});

// src/core/doctor.ts
var doctor_exports = {};
__export(doctor_exports, {
  exitCodeFor: () => exitCodeFor,
  renderReport: () => renderReport,
  runDoctor: () => runDoctor
});
import { spawnSync as spawnSync2 } from "node:child_process";
import { access, readFile as readFile11, stat as stat4 } from "node:fs/promises";
import { resolve as resolve13 } from "node:path";
async function exists2(path) {
  return access(path).then(
    () => true,
    () => false
  );
}
async function runDoctor(targetInput, options = {}) {
  const target = resolve13(targetInput);
  const runner = options.runner ?? run;
  const checks = [];
  let state;
  try {
    state = await readInstallState(target);
  } catch (error) {
    checks.push({
      name: "installation",
      status: "fail",
      message: `.workflow/state.json cannot be read: ${error.message}`,
      remedy: "wfctl init knowledge   (after moving the unreadable file aside)"
    });
    return { target, checks };
  }
  if (!state) {
    checks.push({
      name: "installation",
      status: "fail",
      message: "This is not an initialized knowledge repository",
      remedy: "wfctl init knowledge"
    });
    return { target, checks };
  }
  if (typeof state.files !== "object" || state.files === null) {
    checks.push({
      name: "installation",
      status: "fail",
      message: ".workflow/state.json has no file record, so nothing owned can be checked",
      remedy: "wfctl init knowledge"
    });
    return { target, checks };
  }
  checks.push({
    name: "installation",
    status: "pass",
    message: `wfctl ${state.installedVersion}, ${Object.keys(state.files).length} owned file(s)`
  });
  const plan = options.distribution ? await planInstall({
    target,
    distribution: options.distribution,
    version: state.installedVersion
  }) : void 0;
  if (plan) {
    const pending = plan.operations.filter((operation) => operation.kind === "write");
    if (pending.length > 0) {
      checks.push({
        name: "installation-pending",
        status: "warn",
        message: `${pending.length} file(s) would be written by a reinstall`,
        remedy: "wfctl init knowledge"
      });
    }
    if (plan.obsolete.length > 0) {
      checks.push({
        name: "installation-obsolete",
        status: "warn",
        message: `${plan.obsolete.length} retired wfctl file(s) will be removed by init`
      });
    }
  }
  const obsolete = new Set(plan?.obsolete ?? []);
  const missing = [];
  for (const path of Object.keys(state.files)) {
    if (obsolete.has(path)) continue;
    if (!await exists2(resolve13(target, path))) missing.push(path);
  }
  checks.push({
    name: "installed-files",
    status: missing.length > 0 ? "fail" : "pass",
    message: missing.length > 0 ? `${missing.length} missing: ${missing.join(", ")}` : "All present",
    ...missing.length > 0 ? { remedy: "wfctl init knowledge" } : {}
  });
  const git = runner("git", ["rev-parse", "--is-inside-work-tree"], { cwd: target });
  checks.push({
    name: "git",
    status: git.status === 0 ? "pass" : "warn",
    message: git.status === 0 ? "Git repository" : "Not a Git repository; knowledge has no history and cannot be shared",
    ...git.status === 0 ? {} : { remedy: "git init" }
  });
  const absentDirs = [];
  for (const directory of KNOWLEDGE_DIRECTORIES) {
    const found = await stat4(resolve13(target, directory)).then(
      (entry) => entry.isDirectory(),
      () => false
    );
    if (!found) absentDirs.push(directory);
  }
  checks.push({
    name: "knowledge-layout",
    status: absentDirs.length > 0 ? "fail" : "pass",
    message: absentDirs.length > 0 ? `Missing: ${absentDirs.join(", ")}` : "Complete",
    ...absentDirs.length > 0 ? { remedy: "wfctl init knowledge" } : {}
  });
  for (const directory of SKILL_DIRS) {
    const skill = resolve13(target, directory, "SKILL.md");
    const present = await exists2(skill);
    const frontmatter2 = present ? (await readFile11(skill, "utf8")).startsWith("---\nname: wfctl") : false;
    checks.push({
      name: `skill:${directory.split("/")[0]}`,
      status: present && frontmatter2 ? "pass" : "fail",
      message: present ? frontmatter2 ? "Installed" : "Present but its frontmatter is not wfctl's" : "Missing \u2014 the agent has no entry point",
      ...present && frontmatter2 ? {} : { remedy: "wfctl init knowledge" }
    });
  }
  const block = await readFile11(resolve13(target, "AGENTS.md"), "utf8").catch(() => "");
  checks.push({
    name: "managed-block",
    status: block.includes("wfctl:begin") ? "pass" : "fail",
    message: block.includes("wfctl:begin") ? "Present in AGENTS.md" : "Absent \u2014 nothing points the agent at the skill",
    ...block.includes("wfctl:begin") ? {} : { remedy: "wfctl init knowledge" }
  });
  const registry = await readRegistry(target);
  if (registry.length === 0) {
    checks.push({
      name: "repositories",
      status: "warn",
      message: "None registered for optional cross-repository lookup",
      remedy: "wfctl repo add <owner/name> --path <dir>"
    });
  } else {
    for (const leaf of await inspectLeaves(registry)) {
      const status = leaf.graph === "ready" ? "pass" : leaf.graph === "unreachable" ? "fail" : "warn";
      checks.push({
        name: `leaf:${leaf.repository}/${leaf.worktreeId}`,
        status,
        message: leaf.graph === "ready" ? `Graph ${leaf.ageDays}d old` : leaf.graph === "stale" ? `Graph ${leaf.ageDays}d old; it answers confidently about code that may be gone` : leaf.graph === "missing" ? "No graph; nothing here can traverse it" : `${leaf.path} is not there`,
        ...leaf.graph === "unreachable" ? { remedy: `wfctl repo remove ${leaf.repository} --worktree ${leaf.worktreeId}` } : leaf.graph === "ready" ? {} : { remedy: `graphify build   (in ${leaf.path})` }
      });
    }
    const graphify = runner("graphify", ["--version"]);
    checks.push({
      name: "graphify",
      status: graphify.status === 0 ? "pass" : "warn",
      message: graphify.status === 0 ? graphify.stdout.trim() || "Available" : "Not installed",
      ...graphify.status === 0 ? {} : { remedy: "uv tool install graphifyy" }
    });
  }
  const { collectPages: collectPages2, validateCurated: validateCurated2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
  const pages = await collectPages2(target);
  if (pages.length === 0) {
    checks.push({
      name: "curated-knowledge",
      status: "warn",
      message: "No curated pages yet"
    });
  } else {
    const issues = await validateCurated2(target);
    checks.push({
      name: "curated-knowledge",
      status: issues.length > 0 ? "fail" : "pass",
      message: issues.length > 0 ? `${pages.length} page(s), ${issues.length} structural problem(s)` : `${pages.length} page(s), all structurally valid`,
      ...issues.length > 0 ? { remedy: "wfctl knowledge validate" } : {}
    });
  }
  const qmd = runner("qmd", ["status"], { cwd: target });
  if (qmd.status !== 0) {
    checks.push({
      name: "qmd",
      status: "warn",
      message: "Not available; curated knowledge can only be searched by reading it",
      remedy: "Install QMD, then: qmd index"
    });
  } else {
    checks.push({ name: "qmd", status: "pass", message: "Index opens" });
    const pending = /pending|not embedded|needs embedding/i.test(qmd.stdout);
    checks.push({
      name: "qmd-embeddings",
      status: pending ? "warn" : "pass",
      message: pending ? "Documents await embedding; semantic retrieval will silently fall back to lexical" : "Ready",
      ...pending ? { remedy: "qmd embed" } : {}
    });
  }
  return { target, checks };
}
function renderReport(report) {
  const symbol = { pass: "ok  ", warn: "warn", fail: "FAIL" };
  const lines = report.checks.map((check) => {
    const head2 = `${symbol[check.status]}  ${check.name.padEnd(28)} ${check.message}`;
    return check.status === "pass" || !check.remedy ? head2 : `${head2}
      \u2192 ${check.remedy}`;
  });
  const failed = report.checks.filter((check) => check.status === "fail").length;
  const warned = report.checks.filter((check) => check.status === "warn").length;
  return [
    ...lines,
    "",
    failed > 0 ? `${failed} failing, ${warned} degraded.` : warned > 0 ? `Healthy, ${warned} degraded.` : "Healthy."
  ].join("\n");
}
function exitCodeFor(report) {
  return report.checks.some((check) => check.status === "fail") ? 1 : 0;
}
var run;
var init_doctor = __esm({
  "src/core/doctor.ts"() {
    "use strict";
    init_install();
    init_leaves();
    init_registry();
    run = (command, args, options) => {
      const result = spawnSync2(command, args, {
        cwd: options?.cwd,
        encoding: "utf8",
        timeout: 2e4
      });
      return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? ""
      };
    };
  }
});

// src/core/cli.ts
init_gates();
import { existsSync, realpathSync as realpathSync2 } from "node:fs";
import { readFile as readFile12 } from "node:fs/promises";
import { dirname as dirname7, resolve as resolve14 } from "node:path";
import { fileURLToPath } from "node:url";

// src/core/flags.ts
init_gates();
var NONE = { value: [], boolean: [] };
var COMMAND_FLAGS = {
  "bundle create": { value: ["id", "title", "scope", "agreed"], boolean: [] },
  "bundle list": NONE,
  "bundle show": { value: ["id"], boolean: [] },
  "unit create": { value: ["bundle", "id", "title", "outcome", "boundary", "agreed"], boolean: [] },
  "unit list": { value: ["bundle"], boolean: [] },
  "unit show": { value: ["bundle", "id"], boolean: [] },
  "flow checkpoint": { value: ["namespace", "id", "instruction", "last", "next", "link", "blocker", "checkout", "revision"], boolean: [] },
  "flow handoff": { value: ["namespace", "id"], boolean: [] },
  "flow list": { value: ["namespace"], boolean: [] },
  "repo add": { value: ["path", "worktree", "checkout"], boolean: [] },
  "repo list": NONE,
  "repo remove": { value: ["worktree"], boolean: [] },
  "trajectory append": { value: ["subject", "summary", "axis", "claim", "at", "change", "settles"], boolean: [] },
  "trajectory list": NONE,
  "trajectory show": NONE,
  "reconstruct start": NONE,
  "reconstruct status": NONE,
  "reconstruct scope": { value: ["repository", "revision", "raw", "in", "not"], boolean: [] },
  "reconstruct read": { value: ["at"], boolean: [] },
  "reconstruct exclude": { value: ["reason"], boolean: [] },
  "reconstruct contradiction": { value: ["subject", "side"], boolean: [] },
  "reconstruct resolve": { value: ["resolution"], boolean: [] },
  "reconstruct subject": NONE,
  "reconstruct probe": { value: ["question", "page", "asker", "answer"], boolean: ["passed"] },
  "reconstruct stage": NONE,
  "reconstruct abandon": { value: ["reason"], boolean: [] },
  "reconstruct close": NONE,
  "init": { value: ["target"], boolean: [] },
  "guide": NONE,
  "decided": NONE,
  "knowledge validate": { value: ["page"], boolean: [] },
  "knowledge hash": { value: ["page"], boolean: [] },
  "doctor": NONE,
  "help": NONE
};
var ANYWHERE = /* @__PURE__ */ new Map();
for (const [command, spec] of Object.entries(COMMAND_FLAGS)) {
  for (const name3 of [...spec.value, ...spec.boolean]) {
    ANYWHERE.set(name3, [...ANYWHERE.get(name3) ?? [], command]);
  }
}
function resolveCommand(argv) {
  for (let length = Math.min(3, argv.length); length >= 1; length -= 1) {
    const key = argv.slice(0, length).join(" ");
    const spec = COMMAND_FLAGS[key];
    if (spec) return { key, spec };
  }
  return void 0;
}
function flagName(token) {
  return token.slice(2).split("=")[0] ?? "";
}
function normalize(argv) {
  const resolved = resolveCommand(argv);
  if (!resolved) return argv;
  const { spec } = resolved;
  const out = [];
  for (const token of argv) {
    if (!token.startsWith("--") || !token.includes("=")) {
      out.push(token);
      continue;
    }
    const name3 = flagName(token);
    const value = token.slice(name3.length + 3);
    if (spec.boolean.includes(name3)) {
      throw new GateRefusal(
        `--${name3} takes no value.`,
        `--${name3}`,
        `It was given as ${token}. Its presence is the whole meaning; a value attached to it is read by nobody.`
      );
    }
    if (spec.value.includes(name3)) {
      if (!value) {
        throw new GateRefusal(`--${name3} was given without a value.`, `--${name3} "<value>"`);
      }
      out.push(`--${name3}`, value);
      continue;
    }
    out.push(token);
  }
  return out;
}
function validate(argv) {
  const resolved = resolveCommand(argv);
  if (!resolved) return;
  const { key, spec } = resolved;
  const unknown = [];
  for (const token of argv) {
    if (!token.startsWith("--")) continue;
    const name3 = flagName(token);
    if (!name3 || spec.value.includes(name3) || spec.boolean.includes(name3)) continue;
    unknown.push(name3);
  }
  if (unknown.length === 0) return;
  const detail = unknown.map((name3) => {
    const elsewhere = ANYWHERE.get(name3);
    return elsewhere ? `  --${name3} belongs to: ${elsewhere.join(", ")}` : `  --${name3} is read by no command`;
  }).join("\n");
  throw new GateRefusal(
    `${key} does not read ${unknown.map((name3) => `--${name3}`).join(", ")}.`,
    "wfctl help",
    `${detail}

A flag nobody reads is a command running with a meaning you did not intend.`
  );
}

// src/core/cli.ts
init_install();
var USAGE = `wfctl \u2014 optional project records

  --version
  bundle create --id <id> --title <title> --scope <delivery> --agreed <agreement>
  bundle list | show --id <id>
  unit create --bundle <bundle> --id <id> --title <title>
              --outcome <result> --boundary <limits> --agreed <agreement>
  unit list --bundle <bundle> | show --bundle <bundle> --id <id>

  flow checkpoint --namespace <agent> --id <thread>
                  --instruction <current-request> --last <done> --next <action>
                  [--link <path>]... [--blocker <text>]
                  [--checkout <path>] [--revision <sha>]
  flow handoff --namespace <agent> --id <thread>
  flow list --namespace <agent>

  init knowledge [--target <dir>]
  doctor
  guide [<topic>]
  knowledge validate [--page <path>]
  knowledge hash <path>
  repo add|list|remove ...
  reconstruct ...
  trajectory ...
  decided <subject>

Ordinary work requires no wfctl command. Bundle and unit creation require an
explicit agreement. Flow notes are local, short, and selected by namespace.`;
function ok_(stdout) {
  return { stdout, exitCode: 0 };
}
function compose_(parts) {
  return parts.filter((part) => Boolean(part && part.trim())).join("\n\n");
}
function flag(argv, name3) {
  const index = argv.indexOf(`--${name3}`);
  if (index < 0) return void 0;
  const value = argv[index + 1];
  if (value === void 0 || value.startsWith("--")) {
    throw new GateRefusal(
      `--${name3} was given without a value.`,
      `--${name3} "<value>"`,
      value === void 0 ? void 0 : `The next argument was ${value}, which is another flag.`
    );
  }
  return value;
}
function optional(key, value) {
  return value === void 0 ? {} : { [key]: value };
}
function flags(argv, name3) {
  const values = [];
  argv.forEach((entry, index) => {
    if (entry !== `--${name3}`) return;
    const value = argv[index + 1];
    if (value === void 0 || value.startsWith("--")) {
      throw new GateRefusal(`--${name3} was given without a value.`, `--${name3} "<value>"`);
    }
    values.push(value);
  });
  return values;
}
function exactRecordFlags(argv, repeatable = []) {
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === void 0 || value.startsWith("--")) {
      throw new GateRefusal("Unexpected record command argument.", "Use named --flags with one value each.");
    }
    if (seen.has(key) && !repeatable.includes(key)) {
      throw new GateRefusal(`${key} was supplied more than once.`, "Use one value for this field.");
    }
    seen.add(key);
  }
}
function oneOf(value, allowed, name3, fallback) {
  if (value === void 0) {
    if (fallback !== void 0) return fallback;
    throw new GateRefusal(`--${name3} is required.`, `--${name3} <${allowed.join("|")}>`);
  }
  if (!allowed.includes(value)) {
    throw new GateRefusal(
      `${value} is not a valid ${name3}.`,
      `--${name3} <${allowed.join("|")}>`
    );
  }
  return value;
}
async function run2(argv, context) {
  return dispatch(argv, context);
}
async function dispatch(argv, context) {
  if (argv.includes("--help")) {
    return { stdout: USAGE, exitCode: 0 };
  }
  if (argv.length === 1 && argv[0] === "--version") {
    const packageFile = resolve14(context.assets, "..", "..", "package.json");
    const metadata = JSON.parse(await readFile12(packageFile, "utf8"));
    return ok_(metadata.version ?? "unknown");
  }
  let scanned;
  try {
    scanned = normalize(argv);
    validate(scanned);
  } catch (error) {
    if (error instanceof GateRefusal) {
      return { stdout: error.render(), exitCode: 2 };
    }
    throw error;
  }
  const [group, ...rest] = scanned;
  try {
    switch (group) {
      case void 0:
      case "help":
        return { stdout: USAGE, exitCode: 0 };
      case "bundle": {
        const { bundleCreate: bundleCreate2, bundleList: bundleList2, bundleShow: bundleShow2 } = await Promise.resolve().then(() => (init_voluntary_records(), voluntary_records_exports));
        const [action, ...args] = rest;
        exactRecordFlags(args);
        if (action === "list") return ok_(await bundleList2(context.root));
        if (action === "show") return ok_(await bundleShow2(context.root, flag(args, "id") ?? ""));
        if (action === "create") return ok_(await bundleCreate2(context.root, {
          id: flag(args, "id") ?? "",
          title: flag(args, "title") ?? "",
          scope: flag(args, "scope") ?? "",
          agreed: flag(args, "agreed") ?? ""
        }));
        throw new GateRefusal("Unknown bundle action.", "wfctl bundle <create|list|show>");
      }
      case "unit": {
        const { unitCreate: unitCreate2, unitList: unitList2, unitShow: unitShow2 } = await Promise.resolve().then(() => (init_voluntary_records(), voluntary_records_exports));
        const [action, ...args] = rest;
        exactRecordFlags(args);
        if (action === "list") return ok_(await unitList2(context.root, flag(args, "bundle") ?? ""));
        if (action === "show") return ok_(await unitShow2(context.root, flag(args, "bundle") ?? "", flag(args, "id") ?? ""));
        if (action === "create") return ok_(await unitCreate2(context.root, {
          bundle: flag(args, "bundle") ?? "",
          id: flag(args, "id") ?? "",
          title: flag(args, "title") ?? "",
          outcome: flag(args, "outcome") ?? "",
          boundary: flag(args, "boundary") ?? "",
          agreed: flag(args, "agreed") ?? ""
        }));
        throw new GateRefusal("Unknown unit action.", "wfctl unit <create|list|show>");
      }
      case "flow": {
        const { recoveryCheckpoint: recoveryCheckpoint2, recoveryHandoff: recoveryHandoff2, recoveryList: recoveryList2 } = await Promise.resolve().then(() => (init_recovery_notes(), recovery_notes_exports));
        const [action, ...args] = rest;
        exactRecordFlags(args, ["--link"]);
        const namespace = flag(args, "namespace") ?? "";
        if (action === "list") return ok_(await recoveryList2(context.root, namespace));
        if (action === "handoff") return ok_(await recoveryHandoff2(context.root, namespace, flag(args, "id") ?? ""));
        if (action === "checkpoint") return ok_(await recoveryCheckpoint2(context.root, {
          namespace,
          id: flag(args, "id") ?? "",
          instruction: flag(args, "instruction") ?? "",
          last: flag(args, "last") ?? "",
          next: flag(args, "next") ?? "",
          links: flags(args, "link"),
          ...optional("blocker", flag(args, "blocker")),
          ...optional("checkout", flag(args, "checkout")),
          ...optional("revision", flag(args, "revision"))
        }));
        throw new GateRefusal("Unknown flow action.", "wfctl flow <checkpoint|handoff|list>");
      }
      case "guide": {
        const { GUIDE_TOPICS: GUIDE_TOPICS2, loadGuidance: loadGuidance2 } = await Promise.resolve().then(() => (init_guidance(), guidance_exports));
        const topic = rest[0];
        if (topic === "tidy") {
          return ok_(await readFile12(resolve14(context.assets, "..", "skill/wfctl/references/tidying.md"), "utf8"));
        }
        if (!topic) {
          return {
            stdout: `topics: tidy, ${Object.keys(GUIDE_TOPICS2).sort().join(", ")}`,
            exitCode: 0
          };
        }
        const key = GUIDE_TOPICS2[topic] ?? (/^(strategy|personality)\/[a-z][a-z0-9-]*$/.test(topic) ? topic : void 0);
        if (!key) {
          return {
            stdout: `No guide named ${topic}.
topics: tidy, ${Object.keys(GUIDE_TOPICS2).sort().join(", ")}

Strategies and personalities are read by their guidance path.`,
            exitCode: 1
          };
        }
        const text = await loadGuidance2({ root: context.assets }, key);
        return { stdout: text ?? `The ${topic} guide is missing from this installation.`, exitCode: text ? 0 : 2 };
      }
      case "repo": {
        const { addRepository: addRepository2, readRegistry: readRegistry2, removeRepository: removeRepository2, renderRegistry: renderRegistry2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
        const { graphSetup: graphSetup2, inspectLeaf: inspectLeaf2, inspectLeaves: inspectLeaves2, renderLeaves: renderLeaves2 } = await Promise.resolve().then(() => (init_leaves(), leaves_exports));
        const [action, ...args] = rest;
        if (action === "add") {
          const repository = args[0] ?? "";
          const path = flag(args, "path") ?? "";
          const worktreeId = flag(args, "worktree") ?? "main";
          const { currentBranch: currentBranch2 } = await Promise.resolve().then(() => (init_git(), git_exports));
          const checkout = flag(args, "checkout") ?? (flag(args, "worktree") ? worktreeId : currentBranch2(path) || worktreeId);
          const entry = { repository, checkout, path, worktreeId };
          const entries = await addRepository2(context.root, entry);
          const state = await inspectLeaf2(entry);
          return ok_(
            compose_([
              renderRegistry2(entries),
              state.graph === "missing" ? graphSetup2(state.path) : void 0,
              state.graph === "unreachable" ? `${state.path} is not there.` : void 0,
              state.graph === "stale" ? `Its graph is ${state.ageDays} days old. Rebuild before relying on it: graphify build (in ${state.path})` : void 0
            ])
          );
        }
        if (action === "remove") {
          const entries = await removeRepository2(
            context.root,
            args[0] ?? "",
            flag(args, "worktree")
          );
          return ok_(renderRegistry2(entries));
        }
        if (action === "list" || action === void 0) {
          return ok_(renderLeaves2(await inspectLeaves2(await readRegistry2(context.root))));
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "trajectory": {
        const { appendEvent: appendEvent2, listTrajectories: listTrajectories2, readTrajectory: readTrajectory2, renderTrajectory: renderTrajectory2, subjectId: subjectId2 } = await Promise.resolve().then(() => (init_trajectory(), trajectory_exports));
        const [action, ...args] = rest;
        if (action === "append") {
          const trajectory = await appendEvent2(context.root, flag(args, "subject") ?? "", {
            summary: flag(args, "summary") ?? "",
            axis: oneOf(flag(args, "axis"), ["intent", "delivery", "vision"], "axis"),
            claims: flags(args, "claim"),
            ...flag(args, "at") ? { at: flag(args, "at") } : {},
            ...flag(args, "change") ? { change: flag(args, "change") } : {},
            ...flag(args, "settles") ? { settles: flag(args, "settles") } : {}
          });
          return ok_(renderTrajectory2(trajectory));
        }
        if (action === "show") {
          const trajectory = await readTrajectory2(context.root, subjectId2(args[0] ?? ""));
          if (!trajectory) {
            return { stdout: `No trajectory for ${args[0]}.`, exitCode: 1 };
          }
          return ok_(renderTrajectory2(trajectory));
        }
        const all = await listTrajectories2(context.root);
        return ok_(
          all.length === 0 ? "no trajectories yet." : all.map((entry) => `${entry.id}  ${entry.events.length} event(s)  ${entry.subject}`).join("\n")
        );
      }
      case "reconstruct": {
        const reconstruct = await Promise.resolve().then(() => (init_reconstruct(), reconstruct_exports));
        const { readRegistry: readRegistry2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
        const [action, ...args] = rest;
        if (action === "start") {
          const open = await reconstruct.currentCase(context.root);
          if (open) {
            throw new GateRefusal(
              `Reconstruction ${open.id} is already open at stage ${open.stage}.`,
              `wfctl reconstruct close`,
              "Opening another would overwrite it in place, losing its coverage, contradictions and probes."
            );
          }
          const repositories = await readRegistry2(context.root);
          if (repositories.length === 0) {
            throw new GateRefusal(
              "No repositories are registered, so there is nothing to read.",
              "wfctl repo add <owner/name> --path <dir>"
            );
          }
          const raw = await reconstruct.rawInventory(context.root);
          const baseline = await reconstruct.hasBaseline(context.root);
          const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const id = `${stamp}-reconstruct`;
          await reconstruct.writeCase(context.root, {
            id,
            stage: "scope",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            repositories: [],
            rawPaths: raw,
            coverage: { inScope: [], read: [], excluded: [] },
            claims: [],
            contradictions: [],
            trajectories: [],
            probes: [],
            hadBaseline: baseline
          });
          const { loadGuidance: loadGuidance2 } = await Promise.resolve().then(() => (init_guidance(), guidance_exports));
          const scopeGuidance = await loadGuidance2({ root: context.assets }, "reconstruct/scope");
          await reconstruct.setCurrentCase(context.root, id);
          return ok_(
            [
              `reconstruction ${id} opened`,
              baseline ? "Curated knowledge already holds pages, so this is a re-check of an existing baseline." : "Curated knowledge is empty, so this is a first baseline.",
              "",
              "registered:",
              ...repositories.map((entry) => `  ${entry.repository}  ${entry.worktreeId}  ${entry.path}`),
              "",
              raw.length > 0 ? `raw material: ${raw.length} file(s) under reconstruction/raw/` : "raw material: none",
              "",
              scopeGuidance ?? ""
            ].join("\n")
          );
        }
        const record = await reconstruct.currentCase(context.root);
        if (!record) {
          throw new GateRefusal(
            "No reconstruction is open.",
            "wfctl reconstruct start"
          );
        }
        if (action === "status") return ok_(reconstruct.renderStatus(record));
        if (action === "scope") {
          const { readRegistry: readRegistry3 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
          const { head: head2, resolveRevision: resolveRevision2 } = await Promise.resolve().then(() => (init_git(), git_exports));
          const registered = await readRegistry3(context.root);
          const repositories = flags(args, "repository").map((name3) => {
            const entry = registered.find((candidate) => candidate.repository === name3);
            if (!entry) {
              throw new GateRefusal(
                `${name3} is not registered, so there is no checkout to read.`,
                `wfctl repo add ${name3} --path <dir>`
              );
            }
            const asked = flag(args, "revision");
            const observed = head2(entry.path);
            return {
              ...entry,
              revision: asked ? resolveRevision2(entry.path, asked) : observed.revision,
              dirty: observed.dirty
            };
          });
          const next = await reconstruct.recordScope(context.root, record, {
            repositories,
            rawScope: oneOf(flag(args, "raw"), ["all", "selected", "none"], "raw", "none"),
            inScope: flags(args, "in"),
            exclude: flags(args, "not")
          });
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "read" && flag(args, "at")) {
          const { citation: citation2, readAt: readAt2 } = await Promise.resolve().then(() => (init_git(), git_exports));
          const { readRegistry: readRegistry3 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
          const name3 = flag(args, "at") ?? "";
          const entry = (await readRegistry3(context.root)).find(
            (candidate) => candidate.repository === name3
          );
          const pinned = record.repositories.find((candidate) => candidate.repository === name3);
          if (!entry || !pinned) {
            throw new GateRefusal(
              `${name3} is not in this case's scope.`,
              "wfctl reconstruct status"
            );
          }
          const file = args[0] ?? "";
          const body = readAt2(entry.path, pinned.revision, file);
          return ok_(
            [`${citation2(name3, pinned.revision, file)}`, "", body].join("\n")
          );
        }
        if (action === "read") {
          const next = await reconstruct.markRead(context.root, record, args[0] ?? "");
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "exclude") {
          const next = await reconstruct.markExcluded(
            context.root,
            record,
            args[0] ?? "",
            flag(args, "reason") ?? ""
          );
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "contradiction") {
          const next = await reconstruct.recordContradiction(context.root, record, {
            subject: flag(args, "subject") ?? "",
            sides: flags(args, "side")
          });
          const recorded = next.contradictions[next.contradictions.length - 1];
          return ok_(
            `${recorded?.id}  ${recorded?.subject}
recorded; ${next.contradictions.length} to adjudicate after the crawl.
resolve it later with: wfctl reconstruct resolve ${recorded?.id} --resolution "<what they decided>"`
          );
        }
        if (action === "resolve") {
          const next = await reconstruct.resolveContradiction(
            context.root,
            record,
            args[0] ?? "",
            flag(args, "resolution") ?? ""
          );
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "probe") {
          const next = await reconstruct.recordProbe(context.root, record, {
            question: flag(args, "question") ?? "",
            pages: flags(args, "page"),
            asker: flag(args, "asker") ?? context.actor,
            ...flag(args, "answer") ? { answer: flag(args, "answer") } : {},
            passed: args.includes("--passed")
          }, context.actor);
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "subject") {
          const { readTrajectory: readTrajectory2, subjectId: subjectId2, listTrajectories: listTrajectories2 } = await Promise.resolve().then(() => (init_trajectory(), trajectory_exports));
          const named = args[0] ?? "";
          const found = await readTrajectory2(context.root, named) ?? await readTrajectory2(context.root, subjectId2(named));
          if (!found) {
            const all = await listTrajectories2(context.root);
            throw new GateRefusal(
              `No trajectory for ${named}.`,
              'wfctl trajectory append --subject "<the product subject>" --summary "<what happened>" --axis <intent|delivery|vision>',
              all.length > 0 ? `Assembled so far:
${all.map((entry) => `  ${entry.id}  ${entry.subject}`).join("\n")}` : "Nothing has been assembled yet."
            );
          }
          const next = {
            ...record,
            trajectories: [.../* @__PURE__ */ new Set([...record.trajectories, found.id])]
          };
          await reconstruct.writeCase(context.root, next);
          return ok_(reconstruct.renderStatus(next));
        }
        if (action === "abandon") {
          const reason = flag(args, "reason") ?? "";
          if (!reason.trim()) {
            throw new GateRefusal(
              "Abandoning a reconstruction records why.",
              'wfctl reconstruct abandon --reason "<why this pass is not finishing>"'
            );
          }
          await reconstruct.writeCase(context.root, {
            ...record,
            abandoned: { at: (/* @__PURE__ */ new Date()).toISOString(), reason: reason.trim() }
          });
          const archived = await reconstruct.closeCase(context.root, record.id);
          return ok_(`${record.id} abandoned: ${reason.trim()}
archived at:
${archived}`);
        }
        if (action === "stage") {
          const { loadGuidance: loadGuidance2 } = await Promise.resolve().then(() => (init_guidance(), guidance_exports));
          const advanced = await reconstruct.advanceStage(context.root, record, context.actor);
          const slice = await loadGuidance2(
            { root: context.assets },
            `reconstruct/${advanced.stage}`
          ).catch(() => void 0);
          return ok_(
            compose_([
              slice,
              reconstruct.renderStatus(advanced.record),
              reconstruct.STAGE_PRESENCE[advanced.stage] === "maintainer" ? "This stage needs the maintainer. Put it to them in product language." : "This stage runs unattended. Do not interrupt it with questions."
            ])
          );
        }
        if (action === "close") {
          reconstruct.assertClosable(record, context.actor);
          const outcome = reconstruct.renderOutcome(record);
          const archived = await reconstruct.closeCase(context.root, record.id);
          return ok_(`${outcome}
archived at:
${archived}`);
        }
        return { stdout: USAGE, exitCode: 1 };
      }
      case "decided": {
        const { findDecisions: findDecisions2, renderDecisions: renderDecisions2 } = await Promise.resolve().then(() => (init_decided(), decided_exports));
        const subject = rest.filter((entry) => !entry.startsWith("--")).join(" ");
        if (!subject.trim()) {
          throw new GateRefusal(
            "Naming the subject is the whole of this command.",
            'wfctl decided "<the subject>"'
          );
        }
        return ok_(renderDecisions2(subject, await findDecisions2(context.root, subject)));
      }
      case "knowledge": {
        const { renderIssues: renderIssues2, validateCurated: validateCurated2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
        const [action, ...args] = rest;
        if (action === "validate") {
          const { collectPages: collectPages2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
          const page = flag(args, "page");
          const issues = await validateCurated2(context.root, page);
          const pages = page ? 1 : (await collectPages2(context.root)).length;
          return { stdout: renderIssues2(issues, pages), exitCode: issues.length > 0 ? 2 : 0 };
        }
        if (action === "hash") {
          const { contentHash: contentHash2, stripSeal: stripSeal2, KNOWLEDGE_DIR: KNOWLEDGE_DIR2, normalizePage: normalizePage2 } = await Promise.resolve().then(() => (init_curated(), curated_exports));
          const asked = args[0] ?? flag(args, "page") ?? "";
          const page = normalizePage2(context.root, asked);
          const body = await readFile12(resolve14(context.root, KNOWLEDGE_DIR2, page), "utf8").catch(
            () => void 0
          );
          if (body === void 0) {
            throw new GateRefusal(
              `No page at ${asked}.`,
              "wfctl knowledge validate",
              `Looked in knowledge/ for ${page}.`
            );
          }
          return ok_(contentHash2(stripSeal2(body)));
        }
        return {
          stdout: [
            "wfctl knowledge <validate|hash>",
            "",
            "  validate [--page <path>]   structural checks over curated pages",
            "  hash <path>                the hash both semantic reviews bind to"
          ].join("\n"),
          exitCode: 1
        };
      }
      case "doctor": {
        const { exitCodeFor: exitCodeFor2, renderReport: renderReport2, runDoctor: runDoctor2 } = await Promise.resolve().then(() => (init_doctor(), doctor_exports));
        const report = await runDoctor2(context.root, {
          distribution: resolve14(context.assets, "..", "..")
        });
        return { stdout: renderReport2(report), exitCode: exitCodeFor2(report) };
      }
      case "init": {
        assertProfileSupported(rest[0] ?? "");
        const target = resolve14(flag(rest, "target") ?? process.cwd());
        const distribution = resolve14(context.assets, "..", "..");
        const plan = await planInstall({
          target,
          distribution,
          version: process.env.WFCTL_VERSION ?? "0.10.0"
        });
        const result = await applyInstall(plan, {
          distribution,
          version: process.env.WFCTL_VERSION ?? "0.10.0"
        });
        const lines = [
          `installed into ${target}`,
          `  ${result.created.length} directories, ${result.written.length} files written, ${result.skipped.length} unchanged`
        ];
        if (result.removed.length) lines.push(`  ${result.removed.length} retired wfctl file(s) removed`);
        if (result.replacedHooks.length) {
          lines.push(
            `${result.replacedHooks.length} hook entr(ies) from an older wfctl were removed:`,
            ...result.replacedHooks.map((entry) => `  ${entry}`)
          );
        }
        lines.push(
          "",
          "Guidance is not installed \u2014 it ships with wfctl and is read from there,",
          "so upgrading wfctl upgrades it. There is nothing here to refresh.",
          "",
          "Restart the agent session so the new instructions load."
        );
        return { stdout: lines.join("\n"), exitCode: 0 };
      }
      default:
        return {
          stdout: `wfctl has no command "${group}".

${USAGE}`,
          exitCode: 1
        };
    }
  } catch (error) {
    if (error instanceof GateRefusal) return { stdout: error.render(), exitCode: 2 };
    const detail = error instanceof Error ? error.message : String(error);
    return {
      stdout: new GateRefusal(
        "That could not be completed.",
        "Check the file or state this command reads; if it was edited by hand, repair it.",
        detail
      ).render(),
      exitCode: 2
    };
  }
}
function findGuidance(start) {
  let current = start;
  for (let depth = 0; depth < 3; depth += 1) {
    const candidate = resolve14(current, "templates", "guidance");
    if (existsSync(candidate)) return candidate;
    const parent = dirname7(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve14(start, "templates", "guidance");
}
var invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync2(entry) === realpathSync2(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  const { findRepositoryRoot: findRepositoryRoot2 } = await Promise.resolve().then(() => (init_paths_resolve(), paths_resolve_exports));
  const context = {
    /** Resolve project records from the repository root. */
    root: process.argv[2] === "init" ? process.cwd() : findRepositoryRoot2(process.cwd()),
    assets: findGuidance(import.meta.dirname),
    actor: process.env.WFCTL_ACTOR ?? "agent:unknown"
  };
  const result = await run2(process.argv.slice(2), context);
  process.exitCode = result.exitCode;
  process.stdout.write(`${result.stdout}
`);
}
export {
  USAGE,
  findGuidance,
  run2 as run
};

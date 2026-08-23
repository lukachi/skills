/**
 * Deterministic scorer for the agent-behavior eval corpora.
 *
 * There are no trigger evals any more. A trigger eval asked which skill a prompt
 * would cause the model to load, and nothing is loaded by the model choosing to
 * load it — the tool delivers instructions at states it observes. What is left
 * to evaluate is behaviour: what the agent does once it has been told.
 *
 * Executing a prompt against a real agent is deliberately out of scope: a
 * harness that both supplies and judges routing proves nothing. This script
 * owns the half that can be deterministic — corpus validity, coverage against
 * the repetition requirement in spec/VERIFICATION.md, and pass/fail scoring of
 * recorded runs — so agent-behavior results become a reviewable artifact
 * instead of an unrecorded claim.
 *
 *   bun run test:evals
 *   bun run test:evals -- --require-runs
 *
 * `--require-runs` is the release gate. Without it, missing coverage is an
 * explicit warning; a malformed corpus or a failed recorded run always fails.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evalsRoot = join(root, "evals");
const resultsRoot = join(evalsRoot, "results");
const REQUIRED_REPETITIONS = 3;
const requireRuns = process.argv.slice(2).includes("--require-runs");

const problems = [];
const warnings = [];

function fail(message) {
  problems.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${relative(path)}: cannot parse JSON (${error.message})`);
    return undefined;
  }
}

function relative(path) {
  return path.slice(root.length + 1);
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value)
    && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function suiteDirectories() {
  return readdirSync(evalsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "results")
    .map((entry) => entry.name)
    .sort();
}

/** Validate one corpus and return its entries keyed by id. */
function loadCorpus(suite, kind) {
  const path = join(evalsRoot, suite, `${kind}-evals.json`);
  try {
    statSync(path);
  } catch {
    fail(`evals/${suite}: ${kind}-evals.json is missing`);
    return new Map();
  }
  const entries = readJson(path);
  const byId = new Map();
  if (!Array.isArray(entries)) {
    fail(`${relative(path)}: corpus must be a JSON array`);
    return byId;
  }
  if (entries.length === 0) {
    fail(`${relative(path)}: corpus must not be empty`);
  }
  for (const [index, entry] of entries.entries()) {
    const label = `${relative(path)}[${index}]`;
    if (typeof entry?.id !== "string" || !entry.id.trim()) {
      fail(`${label}: id is required`);
      continue;
    }
    if (byId.has(entry.id)) {
      fail(`${label}: duplicate id ${entry.id}`);
      continue;
    }
    if (typeof entry.prompt !== "string" || !entry.prompt.trim()) {
      fail(`${label}: prompt is required`);
    }
    byId.set(entry.id, entry);
  }
  return byId;
}

function loadResults() {
  let files = [];
  try {
    files = readdirSync(resultsRoot)
      .filter((entry) => entry.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
  const records = [];
  for (const file of files) {
    const path = join(resultsRoot, file);
    const parsed = readJson(path);
    if (!parsed) {
      continue;
    }
    for (const field of ["recorded_at", "agent", "model"]) {
      if (typeof parsed[field] !== "string" || !parsed[field].trim()) {
        fail(`${relative(path)}: ${field} is required`);
      }
    }
    if (!Array.isArray(parsed.runs)) {
      fail(`${relative(path)}: runs must be an array`);
      continue;
    }
    for (const [index, run] of parsed.runs.entries()) {
      records.push({ file: relative(path), index, run, header: parsed });
    }
  }
  return records;
}

/** Score one recorded run against its corpus entry. */
function scoreRun({ file, index, run }, corpora) {
  const label = `${file}#runs[${index}]`;
  const suite = corpora.get(run?.suite);
  if (!suite) {
    fail(`${label}: unknown suite ${JSON.stringify(run?.suite)}`);
    return undefined;
  }
  if (run.kind !== "behavior") {
    fail(`${label}: kind must be behavior`);
    return undefined;
  }
  const entry = suite[run.kind].get(run.eval);
  if (!entry) {
    fail(`${label}: ${run.suite}/${run.kind} has no eval ${JSON.stringify(run.eval)}`);
    return undefined;
  }
  if (!Number.isInteger(run.repetition) || run.repetition < 1) {
    fail(`${label}: repetition must be a positive integer`);
  }

  const failures = [];

  // A read-only expectation is never a judgment call: any changed file fails it.
  const readOnly = entry.forbidden?.some((item) => /read-only|does not (edit|modify|change)|no project state changes|rewrites knowledge/i.test(item))
    || entry.required?.some((item) => /read-only/i.test(item));
  if (readOnly && Array.isArray(run.files_changed) && run.files_changed.length > 0) {
    failures.push(`changed files during a read-only eval: ${run.files_changed.join(", ")}`);
  }

  if (failures.length > 0) {
    fail(`${label}: ${run.suite}/${run.eval} failed — ${failures.join("; ")}`);
  }
  return { key: `${run.suite}/${run.kind}/${run.eval}`, passed: failures.length === 0 };
}

const corpora = new Map();
for (const suite of suiteDirectories()) {
  corpora.set(suite, {
    behavior: loadCorpus(suite, "behavior"),
  });
}

const totalEvals = [...corpora.values()]
  .reduce((total, suite) => total + suite.behavior.size, 0);

const records = loadResults();
const coverage = new Map();
for (const record of records) {
  const scored = scoreRun(record, corpora);
  if (scored) {
    coverage.set(scored.key, (coverage.get(scored.key) ?? 0) + 1);
  }
}

const expectedKeys = [];
for (const [suite, kinds] of corpora) {
  for (const kind of ["behavior"]) {
    for (const id of kinds[kind].keys()) {
      expectedKeys.push(`${suite}/${kind}/${id}`);
    }
  }
}
const uncovered = expectedKeys.filter((key) => (coverage.get(key) ?? 0) < REQUIRED_REPETITIONS);

process.stdout.write(
  `evals: ${corpora.size} suite(s), ${totalEvals} eval(s), `
    + `${records.length} recorded run(s)\n`,
);

for (const warning of warnings) {
  process.stdout.write(`warn: ${warning}\n`);
}

if (uncovered.length > 0) {
  const message = records.length === 0
    ? `no recorded agent-behavior runs; agent behavior is UNPROVEN for this build `
      + `(${uncovered.length} eval(s) need ${REQUIRED_REPETITIONS} repetitions each)`
    : `${uncovered.length} eval(s) lack ${REQUIRED_REPETITIONS} recorded repetitions: `
      + `${uncovered.slice(0, 10).join(", ")}${uncovered.length > 10 ? ", …" : ""}`;
  if (requireRuns) {
    fail(message);
  } else {
    process.stdout.write(`warn: ${message}\n`);
    process.stdout.write(
      "warn: run with --require-runs to make missing coverage a failure\n",
    );
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    process.stderr.write(`fail: ${problem}\n`);
  }
  process.exit(1);
}

process.stdout.write("evals: corpora valid; every recorded run passed\n");

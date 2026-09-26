import { GateRefusal } from "./gates.js";

/** Flags accepted by each current command. */
export interface CommandFlags {
  value: readonly string[];
  boolean: readonly string[];
}

const NONE: CommandFlags = { value: [], boolean: [] };

/** Accepted flags for the current command surface. */
export const COMMAND_FLAGS: Readonly<Record<string, CommandFlags>> = {
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
  "help": NONE,
};

/** Every flag the tool knows, for the "you want a different command" hint. */
const ANYWHERE = new Map<string, string[]>();
for (const [command, spec] of Object.entries(COMMAND_FLAGS)) {
  for (const name of [...spec.value, ...spec.boolean]) {
    ANYWHERE.set(name, [...(ANYWHERE.get(name) ?? []), command]);
  }
}

/** The longest command prefix with an entry, so subcommands beat their group. */
export function resolveCommand(argv: string[]): { key: string; spec: CommandFlags } | undefined {
  for (let length = Math.min(3, argv.length); length >= 1; length -= 1) {
    const key = argv.slice(0, length).join(" ");
    const spec = COMMAND_FLAGS[key];
    if (spec) return { key, spec };
  }
  return undefined;
}

function flagName(token: string): string {
  return token.slice(2).split("=")[0] ?? "";
}

/**
 * Rewrite `--name=value` into `--name value` for flags that take one, and
 * refuse it for flags that do not. Everything downstream reads the plain form.
 */
export function normalize(argv: string[]): string[] {
  const resolved = resolveCommand(argv);
  if (!resolved) return argv;
  const { spec } = resolved;

  const out: string[] = [];
  for (const token of argv) {
    if (!token.startsWith("--") || !token.includes("=")) {
      out.push(token);
      continue;
    }
    const name = flagName(token);
    const value = token.slice(name.length + 3);

    if (spec.boolean.includes(name)) {
      throw new GateRefusal(
        `--${name} takes no value.`,
        `--${name}`,
        `It was given as ${token}. Its presence is the whole meaning; ` +
          "a value attached to it is read by nobody.",
      );
    }
    if (spec.value.includes(name)) {
      if (!value) {
        throw new GateRefusal(`--${name} was given without a value.`, `--${name} "<value>"`);
      }
      out.push(`--${name}`, value);
      continue;
    }
    out.push(token);
  }
  return out;
}

/** Refuse a flag this command does not read, and say where it is read instead. */
export function validate(argv: string[]): void {
  const resolved = resolveCommand(argv);
  if (!resolved) return;
  const { key, spec } = resolved;

  const unknown: string[] = [];
  for (const token of argv) {
    if (!token.startsWith("--")) continue;
    const name = flagName(token);
    if (!name || spec.value.includes(name) || spec.boolean.includes(name)) continue;
    unknown.push(name);
  }
  if (unknown.length === 0) return;

  const detail = unknown
    .map((name) => {
      const elsewhere = ANYWHERE.get(name);
      return elsewhere
        ? `  --${name} belongs to: ${elsewhere.join(", ")}`
        : `  --${name} is read by no command`;
    })
    .join("\n");

  throw new GateRefusal(
    `${key} does not read ${unknown.map((name) => `--${name}`).join(", ")}.`,
    "wfctl help",
    `${detail}\n\nA flag nobody reads is a command running with a meaning you did not intend.`,
  );
}

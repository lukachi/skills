import { GateRefusal } from "./gates.js";

/**
 * What each command accepts, and nothing else.
 *
 * There was one global set of flag names, so every flag was legal on every
 * command: `wfctl capture --worktree x "…"` passed the check and the flag was
 * then read by nobody. A name being spelled correctly somewhere in the tool is
 * not evidence that the command in front of you reads it.
 *
 * The split into value-taking and boolean matters for the same reason it
 * matters in every argument parser, and here it mattered destructively.
 * `--name=value` was accepted by the unknown-flag scan — which split on `=`
 * before looking the name up — and then never seen by `flag()`, which searched
 * for the exact token `--name`. The value vanished and the whole token stayed
 * behind as a positional. `wfctl capture --awaits=true "probe"` recorded a
 * capture whose entire body was the string `--awaits=true`, discarded the real
 * body, and marked it awaiting nobody. A form that silently writes a wrong
 * record is worse than one that is rejected.
 */
export interface CommandFlags {
  /** Flags that take the next argument as their value. */
  value: readonly string[];
  /** Flags whose presence is the whole meaning. */
  boolean: readonly string[];
}

const NONE: CommandFlags = { value: [], boolean: [] };

/**
 * Keyed by the longest command prefix that identifies the action, so
 * `work issue claim` and `work issue drop` are separate entries rather than one
 * permissive `work`.
 */
export const COMMAND_FLAGS: Readonly<Record<string, CommandFlags>> = {
  "brief": { value: [], boolean: ["json"] },
  "handoff": NONE,
  "checkpoint": { value: ["summary", "handoff", "last", "next", "todo"], boolean: [] },

  "work start": { value: ["title", "weight", "attested", "from"], boolean: [] },
  "work adopt": { value: ["attested", "weight", "title", "from"], boolean: [] },
  "work list": NONE,
  "work step": NONE,
  "work issue create": { value: ["title", "satisfies"], boolean: [] },
  "work issue list": NONE,
  "work issue note": { value: ["note"], boolean: [] },
  "work issue claim": { value: ["repository", "worktree"], boolean: [] },
  "work issue complete": NONE,
  "work issue drop": { value: ["reason"], boolean: [] },
  "work park": { value: ["reason", "attested"], boolean: [] },
  "work release": { value: ["attested"], boolean: [] },
  "work verify": { value: ["review"], boolean: [] },
  "work close": { value: ["outcome"], boolean: [] },
  "work promote": { value: ["subject", "summary", "bundle", "settles"], boolean: [] },
  "work promotion draft": NONE,
  "work promotion list": NONE,

  "capture": { value: [], boolean: ["awaits"] },

  "repo add": { value: ["path", "worktree", "checkout"], boolean: [] },
  "repo list": NONE,
  "repo remove": { value: ["worktree"], boolean: [] },

  "reconstruct start": NONE,
  "reconstruct status": NONE,
  "reconstruct scope": {
    value: ["repository", "revision", "raw", "in", "not"],
    boolean: [],
  },
  "reconstruct read": { value: ["at"], boolean: [] },
  "reconstruct exclude": { value: ["reason"], boolean: [] },
  "reconstruct contradiction": { value: ["subject", "side"], boolean: [] },
  "reconstruct resolve": { value: ["resolution"], boolean: [] },
  "reconstruct subject": NONE,
  "reconstruct probe": {
    value: ["question", "page", "asker", "answer"],
    boolean: ["passed"],
  },
  "reconstruct stage": NONE,
  "reconstruct abandon": { value: ["reason"], boolean: [] },
  "reconstruct close": NONE,

  "trajectory append": {
    value: ["subject", "summary", "axis", "claim", "at", "change", "settles"],
    boolean: [],
  },
  "trajectory list": NONE,
  "trajectory show": NONE,

  "recall list": NONE,
  "recall answer": { value: ["answer", "route", "source"], boolean: [] },
  "recall route": { value: ["covered"], boolean: [] },

  "flow close": NONE,

  "init": { value: ["target"], boolean: [] },
  "guide": NONE,
  "debts": NONE,
  "decided": NONE,

  "knowledge validate": { value: ["page"], boolean: [] },
  "knowledge hash": { value: ["page"], boolean: [] },

  "doctor": NONE,
  "guards": NONE,
  "hook write": { value: ["target"], boolean: [] },
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
 * Whether a token could be a flag at all.
 *
 * A real flag name is one word of lowercase letters, digits and hyphens.
 * Anything else opening with dashes is prose — which is what makes a capture
 * body like "--fix the parser, it drops the last token" recordable without
 * exempting capture from flag checking altogether.
 */
const FLAG_SHAPED = /^--[a-z][a-z0-9-]*(=.*)?$/;

/**
 * A capture's body is an argument even when it opens with dashes.
 *
 * A finding phrased "--fix the parser" has to be recordable, and capture is the
 * only sanctioned outlet while a flow is open. Only the flags capture actually
 * declares are treated as flags here; everything else is its text.
 */
function isCaptureBody(argv: string[], index: number): boolean {
  if (argv[0] !== "capture" || index === 0) return false;
  return !FLAG_SHAPED.test(argv[index] ?? "");
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
  for (const [index, token] of argv.entries()) {
    if (!token.startsWith("--") || !token.includes("=") || isCaptureBody(argv, index)) {
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
  for (const [index, token] of argv.entries()) {
    if (!token.startsWith("--") || isCaptureBody(argv, index)) continue;
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

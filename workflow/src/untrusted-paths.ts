/**
 * Shared trust-boundary detection for curated knowledge and project change
 * records. Both surfaces must never *cite* `raw/` or `intake/` material.
 *
 * The check deliberately targets citation contexts instead of any occurrence of
 * the words. Ordinary prose such as "we deleted the raw/ dump" or a sentence
 * starting with "Intake: three files were reviewed" is a description, not a
 * citation, and must not fail a completion or validation gate.
 *
 * A citation is one of:
 *
 * - a Markdown inline link or image target: `[text](raw/notes.md)`;
 * - a Markdown reference definition: `[label]: intake/cases/active/x.md`;
 * - a Markdown autolink: `<raw/notes.md>`;
 * - an explicit resource scheme: `raw:...` / `intake:...`;
 * - a YAML/JSON scalar whose whole value is such a path.
 */

const UNTRUSTED_ROOT = String.raw`(?:\.{1,2}\/)*(?:raw|intake)\/[^\s)>"'\`\]]+`;
const UNTRUSTED_SCHEME = String.raw`(?:raw|intake):[^\s)>"'\`\]]+`;
const UNTRUSTED_TARGET = `(?:${UNTRUSTED_ROOT}|${UNTRUSTED_SCHEME})`;

const CITATION_PATTERNS: RegExp[] = [
  // [text](raw/notes.md) and ![alt](intake/cases/...)
  new RegExp(String.raw`\]\(\s*<?${UNTRUSTED_TARGET}`, "i"),
  // [label]: raw/notes.md
  new RegExp(String.raw`^[^\S\n]*\[[^\]\n]+\]:[^\S\n]*<?${UNTRUSTED_TARGET}`, "im"),
  // <raw/notes.md>
  new RegExp(String.raw`<\s*${UNTRUSTED_TARGET}\s*>`, "i"),
  // YAML/JSON scalar whose entire value is the path, quoted or bare.
  new RegExp(String.raw`(?::|=)[^\S\n]*"${UNTRUSTED_TARGET}"`, "i"),
  new RegExp(String.raw`(?::|=)[^\S\n]*'${UNTRUSTED_TARGET}'`, "i"),
  new RegExp(String.raw`(?::|=)[^\S\n]*${UNTRUSTED_TARGET}[^\S\n]*$`, "im"),
  // Bare list item that is only a path: "- raw/notes.md"
  new RegExp(String.raw`^[^\S\n]*-[^\S\n]+${UNTRUSTED_TARGET}[^\S\n]*$`, "im"),
];

/**
 * Report whether the content cites raw or intake material. Descriptive prose
 * mentioning those directories is not a citation and returns false.
 */
export function containsUntrustedIntakeReference(content: string): boolean {
  return CITATION_PATTERNS.some((pattern) => pattern.test(content));
}

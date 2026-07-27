const START_MARKER = "<!-- wfctl:begin -->";
const END_MARKER = "<!-- wfctl:end -->";

export interface ManagedBlockResult {
  content?: string;
  error?: string;
}

export function renderManagedBlock(body: string): string {
  return `${START_MARKER}\n${body.trim()}\n${END_MARKER}`;
}

export function upsertManagedBlock(existing: string, body: string): ManagedBlockResult {
  const startCount = count(existing, START_MARKER);
  const endCount = count(existing, END_MARKER);

  if (startCount === 0 && endCount === 0) {
    const prefix = existing.trimEnd();
    const separator = prefix.length === 0 ? "" : "\n\n";
    return { content: `${prefix}${separator}${renderManagedBlock(body)}\n` };
  }

  if (startCount !== 1 || endCount !== 1) {
    return { error: "managed block markers are malformed or duplicated" };
  }

  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);
  if (end < start) {
    return { error: "managed block end marker appears before its start marker" };
  }

  const after = end + END_MARKER.length;
  return {
    content: `${existing.slice(0, start)}${renderManagedBlock(body)}${existing.slice(after)}`,
  };
}

export function containsManagedBlock(content: string): boolean {
  return count(content, START_MARKER) === 1 && count(content, END_MARKER) === 1;
}

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

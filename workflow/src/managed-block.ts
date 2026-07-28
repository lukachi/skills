const MARKDOWN_MARKERS = {
  start: "<!-- wfctl:begin -->",
  end: "<!-- wfctl:end -->",
};

export const GITIGNORE_MARKERS = {
  start: "# wfctl:begin",
  end: "# wfctl:end",
};

export interface ManagedBlockMarkers {
  start: string;
  end: string;
}

export interface ManagedBlockResult {
  content?: string;
  error?: string;
}

export function renderManagedBlock(
  body: string,
  markers: ManagedBlockMarkers = MARKDOWN_MARKERS,
): string {
  return `${markers.start}\n${body.trim()}\n${markers.end}`;
}

export function upsertManagedBlock(
  existing: string,
  body: string,
  markers: ManagedBlockMarkers = MARKDOWN_MARKERS,
): ManagedBlockResult {
  const startCount = count(existing, markers.start);
  const endCount = count(existing, markers.end);

  if (startCount === 0 && endCount === 0) {
    const prefix = existing.trimEnd();
    const separator = prefix.length === 0 ? "" : "\n\n";
    return {
      content: `${prefix}${separator}${renderManagedBlock(body, markers)}\n`,
    };
  }

  if (startCount !== 1 || endCount !== 1) {
    return { error: "managed block markers are malformed or duplicated" };
  }

  const start = existing.indexOf(markers.start);
  const end = existing.indexOf(markers.end);
  if (end < start) {
    return { error: "managed block end marker appears before its start marker" };
  }

  const after = end + markers.end.length;
  return {
    content: `${existing.slice(0, start)}${
      renderManagedBlock(body, markers)
    }${existing.slice(after)}`,
  };
}

export function containsManagedBlock(
  content: string,
  markers: ManagedBlockMarkers = MARKDOWN_MARKERS,
): boolean {
  return count(content, markers.start) === 1
    && count(content, markers.end) === 1;
}

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

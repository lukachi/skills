import { spawn } from "node:child_process";

export type PinnedGitBlobKind = "text" | "binary" | "unsupported";

export interface PinnedGitTextRange {
  kind: PinnedGitBlobKind;
  reason: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  content: string;
}

export interface PinnedGitTextRangeOptions {
  startLine?: number;
  endLine?: number;
  defaultLines?: number;
  maxLines?: number;
  maxSelectedBytes?: number;
  operationName?: string;
}

export async function readPinnedGitTextRange(
  root: string,
  gitArguments: string[],
  options: PinnedGitTextRangeOptions = {},
): Promise<PinnedGitTextRange> {
  const defaultLines = options.defaultLines ?? 200;
  const maxLines = options.maxLines ?? 400;
  const maxSelectedBytes = options.maxSelectedBytes ?? 8 * 1024 * 1024;
  const requestedStart = options.startLine ?? 1;
  const requestedEnd = options.endLine ?? requestedStart + defaultLines - 1;
  const operationName = options.operationName ?? "Git pinned-blob read";
  validateRequestedRange(requestedStart, requestedEnd, maxLines, operationName);

  const child = spawn("git", ["-C", root, ...gitArguments], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    if (stderr.length < 64 * 1024) {
      stderr += chunk.slice(0, 64 * 1024 - stderr.length);
    }
  });
  const completion = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const selected: string[] = [];
  let pending = "";
  let pendingHasData = false;
  let selectedBytes = 0;
  let totalLines = 0;
  let kind: PinnedGitBlobKind = "text";
  let reason = "";

  const consumeLine = (input: string): void => {
    const line = input.endsWith("\r") ? input.slice(0, -1) : input;
    totalLines += 1;
    if (totalLines >= requestedStart && totalLines <= requestedEnd) {
      selected.push(line);
    }
  };
  const consumeText = (text: string, final = false): void => {
    let cursor = 0;
    while (cursor < text.length) {
      const newline = text.indexOf("\n", cursor);
      const end = newline === -1 ? text.length : newline;
      const segment = text.slice(cursor, end);
      if (segment.length > 0) {
        pendingHasData = true;
        const currentLine = totalLines + 1;
        if (currentLine >= requestedStart && currentLine <= requestedEnd) {
          selectedBytes += Buffer.byteLength(segment);
          if (selectedBytes > maxSelectedBytes) {
            throw new Error(
              `${operationName}: selected line window exceeds ${maxSelectedBytes} bytes`,
            );
          }
          pending += segment;
        }
      }
      if (newline === -1) {
        break;
      }
      consumeLine(pending);
      pending = "";
      pendingHasData = false;
      cursor = newline + 1;
    }
    if (final && pendingHasData) {
      consumeLine(pending);
      pending = "";
      pendingHasData = false;
    }
  };

  try {
    for await (const value of child.stdout) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      if (kind === "text" && chunk.includes(0)) {
        kind = "binary";
        reason = "the pinned blob contains NUL bytes";
        pending = "";
        pendingHasData = false;
        selected.length = 0;
        continue;
      }
      if (kind !== "text") {
        continue;
      }
      let decoded: string;
      try {
        decoded = decoder.decode(chunk, { stream: true });
      } catch {
        kind = "unsupported";
        reason = "the pinned blob is not valid UTF-8 text";
        pending = "";
        pendingHasData = false;
        selected.length = 0;
        continue;
      }
      consumeText(decoded);
    }
    if (kind === "text") {
      let decoded: string;
      try {
        decoded = decoder.decode();
      } catch {
        kind = "unsupported";
        reason = "the pinned blob is not valid UTF-8 text";
        pending = "";
        pendingHasData = false;
        selected.length = 0;
        decoded = "";
      }
      if (kind === "text") {
        consumeText(decoded, true);
      }
    }
  } catch (error) {
    child.kill();
    throw error;
  }

  const status = await completion;
  if (status !== 0) {
    throw new Error(
      `${operationName} failed: ${stderr.trim() || gitArguments.join(" ")}`,
    );
  }
  if (kind !== "text") {
    return {
      kind,
      reason,
      startLine: 0,
      endLine: 0,
      totalLines: 0,
      content: "",
    };
  }
  if (totalLines === 0) {
    if (
      options.startLine !== undefined && options.startLine !== 0
      || options.endLine !== undefined && options.endLine !== 0
    ) {
      throw new Error(`${operationName}: requested line range is outside an empty blob`);
    }
    return {
      kind: "text",
      reason: "",
      startLine: 0,
      endLine: 0,
      totalLines: 0,
      content: "",
    };
  }
  if (requestedStart > totalLines) {
    throw new Error(
      `${operationName}: requested line range ${requestedStart}-${requestedEnd} is outside 1-${totalLines}`,
    );
  }
  if (options.endLine !== undefined && requestedEnd > totalLines) {
    throw new Error(
      `${operationName}: requested line range ${requestedStart}-${requestedEnd} is outside 1-${totalLines}`,
    );
  }
  const endLine = Math.min(totalLines, requestedEnd);
  return {
    kind: "text",
    reason: "",
    startLine: requestedStart,
    endLine,
    totalLines,
    content: selected.slice(0, endLine - requestedStart + 1).join("\n"),
  };
}

function validateRequestedRange(
  startLine: number,
  endLine: number,
  maxLines: number,
  operationName: string,
): void {
  if (
    !Number.isInteger(startLine)
    || !Number.isInteger(endLine)
    || startLine < 0
    || endLine < startLine
  ) {
    throw new Error(`${operationName}: invalid line range ${startLine}-${endLine}`);
  }
  if (startLine === 0 && endLine !== 0) {
    throw new Error(`${operationName}: zero is valid only for an empty blob`);
  }
  if (startLine > 0 && endLine - startLine + 1 > maxLines) {
    throw new Error(
      `${operationName} is limited to ${maxLines} lines; use bounded ranges`,
    );
  }
}

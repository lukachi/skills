import { deriveGap, listTrajectories, type Gap } from "./trajectory.js";

/**
 * What the project accepted and has not delivered, across every subject.
 *
 * The gap for one subject was already derived and rendered inside that
 * subject's line, so finding drift meant reading every trajectory by hand. This
 * is the same subtraction, gathered.
 *
 * Nothing is stored. There is no debt record with a lifecycle of its own,
 * because that was a second work system beside the changes flow — with its own
 * scheduling and deferral — and a gap is supposed to become work *through* that
 * flow. A debt is also not closed by anybody saying so: it dies when the source
 * changes and the subject is re-read at a new revision, which is why the
 * workflow prescribes re-reading rather than accepting a claim that the work
 * was done.
 */
export interface DebtReport {
  /** Intent the project recorded and the source does not deliver. */
  delivery: Gap[];
  /** Declared direction the delivery has not reached. */
  direction: Gap[];
}

export async function collectDebts(root: string): Promise<DebtReport> {
  const gaps = (await listTrajectories(root)).map((trajectory) => deriveGap(trajectory));
  return {
    delivery: gaps.filter((gap) => gap.delivery.length > 0),
    direction: gaps.filter((gap) => gap.direction.length > 0),
  };
}

export function renderDebts(report: DebtReport): string {
  if (report.delivery.length === 0 && report.direction.length === 0) {
    return [
      "No gaps.",
      "",
      "Either everything recorded is delivered, or nothing has been re-read since",
      "it changed. A gap dies when the subject is read again at a new revision —",
      "never because somebody said the work was done.",
    ].join("\n");
  }

  const lines: string[] = [];

  if (report.delivery.length > 0) {
    lines.push("Accepted and not delivered:", "");
    for (const gap of report.delivery) {
      lines.push(`  ${gap.subject}`);
      for (const item of gap.delivery) lines.push(`    ${item}`);
    }
    lines.push("");
  }

  if (report.direction.length > 0) {
    lines.push("Declared direction not yet reached:", "");
    for (const gap of report.direction) {
      lines.push(`  ${gap.subject}`);
      for (const item of gap.direction) lines.push(`    ${item}`);
    }
    lines.push("");
  }

  lines.push(
    "Each becomes work the ordinary way — put it to the maintainer and open a",
    "flow. Grouping several of these by the outcome that would close them",
    "usually turns the list into one decision.",
  );
  return lines.join("\n");
}

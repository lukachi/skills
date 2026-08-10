import { fromMarkdown } from "mdast-util-from-markdown";

interface MarkdownNode {
  type?: string;
  depth?: number;
  value?: string;
  children?: MarkdownNode[];
}

export function discoveryLedgerIssues(
  body: string,
  label: string,
  required: boolean,
): string[] {
  const root = fromMarkdown(body) as unknown as MarkdownNode;
  const children = root.children ?? [];
  const ledgerIndexes = children
    .map((node, index) => ({ node, index }))
    .filter(({ node }) =>
      node.type === "heading"
      && node.depth === 1
      && markdownNodeText(node).trim() === "Discovery ledger"
    )
    .map(({ index }) => index);
  if (ledgerIndexes.length === 0) {
    return required ? [`${label}: Discovery ledger section is required`] : [];
  }

  const issues = ledgerIndexes.length === 1
    ? []
    : [`${label}: exactly one Discovery ledger section is allowed`];
  const ledgerIndex = ledgerIndexes[0]!;
  const ids = new Set<string>();
  for (let index = ledgerIndex + 1; index < children.length; index += 1) {
    const node = children[index]!;
    if (node.type === "heading" && node.depth === 1) {
      break;
    }
    if (node.type !== "heading" || node.depth !== 2) {
      continue;
    }
    const title = markdownNodeText(node).trim();
    // Accept the em dash the templates use plus the hyphen and colon agents
    // reach for by habit; the separator carries no meaning.
    const match = /^(DISC-\d{3,})\s*(?:—|–|-|:)\s+\S/.exec(title);
    if (!match) {
      issues.push(`${label}: discovery entry heading is invalid: ${title || "empty heading"}`);
      continue;
    }
    const id = match[1]!;
    if (ids.has(id)) {
      issues.push(`${label}: duplicate discovery ID ${id}`);
    }
    ids.add(id);

    const entryNodes: MarkdownNode[] = [];
    for (let entryIndex = index + 1; entryIndex < children.length; entryIndex += 1) {
      const entryNode = children[entryIndex]!;
      if (
        entryNode.type === "heading"
        && (entryNode.depth === 1 || entryNode.depth === 2)
      ) {
        break;
      }
      entryNodes.push(entryNode);
    }
    const items = entryNodes
      .flatMap((entryNode) => collectMarkdownNodes(entryNode, "listItem"))
      .map((entryNode) => markdownNodeText(entryNode).trim());

    // A list item has a boundary; a paragraph does not, so accepting both would
    // make the parser guess where one field ends and the next begins. The shape
    // stays strict and the refusal explains itself instead: an entry written as
    // paragraphs was told five times that a field it had written was missing,
    // which reads as a content problem and is a shape problem, and cost five
    // rewrites of correct text before anyone opened this file.
    if (items.length === 0) {
      const paragraphs = entryNodes
        .flatMap((entryNode) => collectMarkdownNodes(entryNode, "paragraph"))
        .map((entryNode) => markdownNodeText(entryNode).trim());
      const misshaped = paragraphs.filter((text) => named(text)).length;
      issues.push(
        misshaped > 0
          ? `${label}: ${id} writes ${misshaped} of its fields as paragraphs; each of `
            + `${FIELDS.join(", ")} must be its own list item, as the shipped template writes them`
          : `${label}: ${id} has none of its fields; write ${FIELDS.join(", ")} as list items, `
            + "one per field, as the shipped template writes them",
      );
      continue;
    }

    for (const field of FIELDS) {
      const value = items.find((item) => new RegExp(`^${field}:`, "i").test(item));
      if (!value || !value.replace(new RegExp(`^${field}:`, "i"), "").trim()) {
        issues.push(`${label}: ${id} requires a non-empty ${field} field`);
      }
    }
  }
  return issues;
}

const FIELDS = ["Observation", "Evidence", "Implication", "Scope", "Disposition"] as const;

/** Whether a block opens with one of the field names, however it is emphasised. */
function named(text: string): boolean {
  return FIELDS.some((field) => new RegExp(`^${field}:`, "i").test(text));
}

function collectMarkdownNodes(node: MarkdownNode, type: string): MarkdownNode[] {
  const matches = node.type === type ? [node] : [];
  for (const child of node.children ?? []) {
    matches.push(...collectMarkdownNodes(child, type));
  }
  return matches;
}

function markdownNodeText(node: MarkdownNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }
  return (node.children ?? []).map(markdownNodeText).join("");
}

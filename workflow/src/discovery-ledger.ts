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
    for (const field of ["Observation", "Evidence", "Implication", "Scope", "Disposition"]) {
      const value = items.find((item) => new RegExp(`^${field}:`, "i").test(item));
      if (!value || !value.replace(new RegExp(`^${field}:`, "i"), "").trim()) {
        issues.push(`${label}: ${id} requires a non-empty ${field} field`);
      }
    }
  }
  return issues;
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

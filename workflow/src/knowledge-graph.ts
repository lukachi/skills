import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, posix, relative, resolve, sep } from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { parse } from "yaml";
import { readConfig } from "./config.js";

const GRAPH_SCHEMA_VERSION = 1;
const GRAPH_PATH = ".workflow/current/knowledge-graph.json";
const RELATION_KINDS = new Set([
  "supports",
  "governed-by",
  "implemented-by",
  "depends-on",
  "affects",
  "conflicts-with",
  "related-to",
]);

export type KnowledgeGraphNodeKind = "concept" | "index" | "log";
export type KnowledgeGraphEdgeOrigin = "markdown" | "frontmatter" | "x-wf";

export interface KnowledgeGraphNode {
  id: string;
  path: string;
  kind: KnowledgeGraphNodeKind;
  title: string;
  description?: string;
  type?: string;
  status?: string;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  kind: string;
  origin: KnowledgeGraphEdgeOrigin;
  context?: string;
  line?: number;
}

export interface KnowledgeGraph {
  schemaVersion: typeof GRAPH_SCHEMA_VERSION;
  okfVersion: "0.2";
  contentHash: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  stats: {
    nodes: number;
    edges: number;
    concepts: number;
  };
}

export interface KnowledgeGraphIssue {
  path: string;
  message: string;
}

export interface KnowledgeGraphCompilation {
  target: string;
  graph: KnowledgeGraph;
  errors: KnowledgeGraphIssue[];
  warnings: KnowledgeGraphIssue[];
}

interface CompileOptions {
  issueSources?: Set<string>;
  checkReachability?: boolean;
}

interface ParsedDocument {
  path: string;
  content: string;
  metadata?: Record<string, unknown>;
  body: string;
  links: MarkdownLink[];
  node: KnowledgeGraphNode;
}

interface MarkdownLink {
  url: string;
  line?: number;
}

interface RelationInput {
  kind: string;
  target: string;
  context: string;
}

export async function compileKnowledgeGraph(
  targetInput: string,
  options: CompileOptions = {},
): Promise<KnowledgeGraphCompilation> {
  const target = await requireKnowledgeRepository(targetInput);
  const knowledgeRoot = join(target, "knowledge");
  const paths = await collectMarkdownPaths(knowledgeRoot);
  const documents = await Promise.all(paths.map(async (path) => {
    const absolute = join(target, path);
    const content = await readFile(absolute, "utf8");
    const parsed = parseFrontmatter(content);
    return {
      path,
      content,
      ...(parsed.metadata ? { metadata: parsed.metadata } : {}),
      body: parsed.body,
      links: markdownLinks(parsed.body, parsed.bodyLineOffset),
      node: graphNode(path, parsed.metadata, parsed.body),
    } satisfies ParsedDocument;
  }));
  const knownPaths = new Set(documents.map((document) => document.path));
  const errors: KnowledgeGraphIssue[] = [];
  const warnings: KnowledgeGraphIssue[] = [];
  const edges: KnowledgeGraphEdge[] = [];

  for (const document of documents) {
    const bodyTargets = new Set<string>();
    for (const link of document.links) {
      const resolved = resolveKnowledgeLink(document.path, link.url, knownPaths);
      if (resolved.kind === "outside") {
        continue;
      }
      if (resolved.kind === "missing") {
        issue(options, errors, {
          path: document.path,
          message: `internal Markdown link does not resolve: ${link.url}`,
        });
        continue;
      }
      bodyTargets.add(resolved.path);
      edges.push({
        source: graphId(document.path),
        target: graphId(resolved.path),
        kind: "references",
        origin: "markdown",
        ...(link.line ? { line: link.line } : {}),
      });
    }

    if (document.node.kind !== "concept" || !document.metadata) {
      continue;
    }

    const workflow = recordValue(document.metadata["x-wf"]);
    const relationValues = workflow?.relations;
    if (!workflow || !Array.isArray(relationValues)) {
      issue(options, errors, {
        path: document.path,
        message: "concept must declare x-wf.relations as a list",
      });
    } else {
      for (const [index, value] of relationValues.entries()) {
        const relation = parseRelation(value);
        const prefix = `x-wf.relations[${index}]`;
        if (!relation) {
          issue(options, errors, {
            path: document.path,
            message: `${prefix} must contain kind, target, and context strings`,
          });
          continue;
        }
        if (!RELATION_KINDS.has(relation.kind)) {
          issue(options, errors, {
            path: document.path,
            message: `${prefix}.kind is unsupported: ${relation.kind}`,
          });
          continue;
        }
        const resolved = resolveKnowledgeLink(
          document.path,
          relation.target,
          knownPaths,
          true,
        );
        if (resolved.kind !== "resolved") {
          issue(options, errors, {
            path: document.path,
            message: `${prefix}.target must resolve to a knowledge Markdown document: ${relation.target}`,
          });
          continue;
        }
        if (!bodyTargets.has(resolved.path)) {
          issue(options, errors, {
            path: document.path,
            message: `${prefix}.target must also appear as a Markdown link in the document body`,
          });
        }
        edges.push({
          source: graphId(document.path),
          target: graphId(resolved.path),
          kind: relation.kind,
          origin: "x-wf",
          context: relation.context,
        });
      }
    }

    addDecisionLineageEdges(document, knownPaths, bodyTargets, edges, errors, options);
    addAreaEdge(document, knownPaths, bodyTargets, edges, errors, options);
  }

  const nodes = documents.map((document) => document.node).sort(compareNodes);
  const deduplicatedEdges = deduplicateEdges(edges).sort(compareEdges);
  if (options.checkReachability !== false) {
    validateReachability(nodes, deduplicatedEdges, errors, warnings, options);
  }
  const contentHash = createHash("sha256")
    .update(documents
      .sort((left, right) => compareText(left.path, right.path))
      .map((document) => `${document.path}\0${document.content}\0`)
      .join(""))
    .digest("hex");
  const graph: KnowledgeGraph = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    okfVersion: "0.2",
    contentHash,
    nodes,
    edges: deduplicatedEdges,
    stats: {
      nodes: nodes.length,
      edges: deduplicatedEdges.length,
      concepts: nodes.filter((node) => node.kind === "concept").length,
    },
  };
  return { target, graph, errors, warnings };
}

export async function writeKnowledgeGraph(
  targetInput: string,
): Promise<KnowledgeGraphCompilation & { path: string }> {
  const result = await compileKnowledgeGraph(targetInput);
  if (result.errors.length > 0) {
    throw new Error(
      `Cannot build knowledge graph: ${result.errors.length} validation error(s) remain`,
    );
  }
  const path = join(result.target, GRAPH_PATH);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(result.graph, null, 2)}\n`, "utf8");
  await rename(temporary, path);
  return { ...result, path };
}

function addDecisionLineageEdges(
  document: ParsedDocument,
  knownPaths: Set<string>,
  bodyTargets: Set<string>,
  edges: KnowledgeGraphEdge[],
  errors: KnowledgeGraphIssue[],
  options: CompileOptions,
): void {
  if (!stringArray(document.metadata?.authority).includes("decision")) {
    return;
  }
  const inputs = [
    ...stringArray(document.metadata?.supersedes).map((target) => ({
      kind: "supersedes",
      target,
    })),
    ...(stringValue(document.metadata?.superseded_by)
      ? [{
        kind: "superseded-by",
        target: stringValue(document.metadata?.superseded_by),
      }]
      : []),
  ];
  for (const input of inputs) {
    const resolved = resolveKnowledgeLink(document.path, input.target, knownPaths, true);
    if (resolved.kind !== "resolved") {
      continue;
    }
    if (!bodyTargets.has(resolved.path)) {
      issue(options, errors, {
        path: document.path,
        message: `${input.kind} target must also appear as a Markdown link in the document body: ${input.target}`,
      });
    }
    edges.push({
      source: graphId(document.path),
      target: graphId(resolved.path),
      kind: input.kind,
      origin: "frontmatter",
    });
  }
}

function addAreaEdge(
  document: ParsedDocument,
  knownPaths: Set<string>,
  bodyTargets: Set<string>,
  edges: KnowledgeGraphEdge[],
  errors: KnowledgeGraphIssue[],
  options: CompileOptions,
): void {
  const match = /^knowledge\/areas\/([^/]+)\/.+\.md$/.exec(document.path);
  if (!match || document.path === `knowledge/areas/${match[1]}/index.md`) {
    return;
  }
  const area = stringValue(document.metadata?.area);
  if (!area) {
    issue(options, errors, {
      path: document.path,
      message: `concept under knowledge/areas/${match[1]}/ must declare area: "${match[1]}"`,
    });
    return;
  }
  if (area !== match[1]) {
    issue(options, errors, {
      path: document.path,
      message: `area must match its path: expected "${match[1]}", found "${area}"`,
    });
    return;
  }
  const areaPath = `knowledge/areas/${area}/index.md`;
  if (!knownPaths.has(areaPath)) {
    issue(options, errors, {
      path: document.path,
      message: `area index does not exist: ${areaPath}`,
    });
    return;
  }
  if (!bodyTargets.has(areaPath)) {
    issue(options, errors, {
      path: document.path,
      message: `Area ${area} must appear as a Markdown link in the document body`,
    });
  }
  edges.push({
    source: graphId(document.path),
    target: graphId(areaPath),
    kind: "belongs-to",
    origin: "frontmatter",
  });
}

function validateReachability(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  errors: KnowledgeGraphIssue[],
  warnings: KnowledgeGraphIssue[],
  options: CompileOptions,
): void {
  const root = graphId("knowledge/index.md");
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  const reached = new Set<string>();
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (reached.has(current)) {
      continue;
    }
    reached.add(current);
    pending.push(...(outgoing.get(current) ?? []));
  }
  for (const node of nodes) {
    if (node.kind !== "concept" || reached.has(node.id)) {
      continue;
    }
    const target = node.status === "stable" ? errors : warnings;
    issue(options, target, {
      path: node.path,
      message: node.status === "stable"
        ? "stable concept is unreachable from knowledge/index.md"
        : "concept is unreachable from knowledge/index.md",
    });
  }
}

function issue(
  options: CompileOptions,
  target: KnowledgeGraphIssue[],
  value: KnowledgeGraphIssue,
): void {
  if (!options.issueSources || options.issueSources.has(value.path)) {
    target.push(value);
  }
}

function graphNode(
  path: string,
  metadata: Record<string, unknown> | undefined,
  body: string,
): KnowledgeGraphNode {
  const name = posix.basename(path);
  const kind: KnowledgeGraphNodeKind = name === "index.md"
    ? "index"
    : name === "log.md"
    ? "log"
    : "concept";
  const title = stringValue(metadata?.title) || firstHeading(body) || graphId(path);
  const description = stringValue(metadata?.description);
  const type = stringValue(metadata?.type);
  const status = stringValue(metadata?.status);
  return {
    id: graphId(path),
    path,
    kind,
    title,
    ...(description ? { description } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };
}

function markdownLinks(body: string, lineOffset: number): MarkdownLink[] {
  const root = fromMarkdown(body) as unknown as MarkdownNode;
  const definitions = new Map<string, string>();
  walkMarkdown(root, (node) => {
    if (node.type === "definition" && node.identifier && node.url) {
      definitions.set(node.identifier.toLowerCase(), node.url);
    }
  });
  const links: MarkdownLink[] = [];
  walkMarkdown(root, (node) => {
    const url = node.type === "link"
      ? node.url
      : node.type === "linkReference" && node.identifier
      ? definitions.get(node.identifier.toLowerCase())
      : undefined;
    if (url) {
      links.push({
        url,
        ...(node.position?.start.line
          ? { line: node.position.start.line + lineOffset }
          : {}),
      });
    }
  });
  return links;
}

interface MarkdownNode {
  type?: string;
  url?: string;
  identifier?: string;
  children?: MarkdownNode[];
  position?: { start: { line?: number } };
}

function walkMarkdown(node: MarkdownNode, visit: (node: MarkdownNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) {
    walkMarkdown(child, visit);
  }
}

function resolveKnowledgeLink(
  sourcePath: string,
  rawUrl: string,
  knownPaths: Set<string>,
  strict = false,
):
  | { kind: "resolved"; path: string }
  | { kind: "missing" }
  | { kind: "outside" } {
  const withoutFragment = rawUrl.split("#", 1)[0]!.split("?", 1)[0]!;
  if (!withoutFragment || /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(withoutFragment)) {
    return { kind: "outside" };
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    return strict ? { kind: "missing" } : { kind: "outside" };
  }
  const candidate = decoded.startsWith("/")
    ? posix.join("knowledge", decoded.replace(/^\/+/, ""))
    : decoded.startsWith("knowledge/")
    ? posix.normalize(decoded)
    : posix.normalize(posix.join(posix.dirname(sourcePath), decoded));
  if (candidate !== "knowledge" && !candidate.startsWith("knowledge/")) {
    return { kind: "outside" };
  }
  const possible = candidate === "knowledge"
    ? ["knowledge/index.md"]
    : extname(candidate)
    ? [candidate]
    : decoded.endsWith("/")
    ? [posix.join(candidate, "index.md")]
    : [`${candidate}.md`, posix.join(candidate, "index.md")];
  const resolved = possible.find((path) => knownPaths.has(path));
  if (resolved) {
    return { kind: "resolved", path: resolved };
  }
  const markdownLike = strict
    || extname(candidate).toLowerCase() === ".md"
    || extname(candidate) === "";
  return markdownLike ? { kind: "missing" } : { kind: "outside" };
}

function parseFrontmatter(content: string): {
  metadata?: Record<string, unknown>;
  body: string;
  bodyLineOffset: number;
} {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return { body: content, bodyLineOffset: 0 };
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    return { body: content, bodyLineOffset: 0 };
  }
  try {
    const metadata = parse(lines.slice(1, end).join("\n")) as unknown;
    return {
      ...(isRecord(metadata) ? { metadata } : {}),
      body: lines.slice(end + 1).join("\n"),
      bodyLineOffset: end + 1,
    };
  } catch {
    return {
      body: lines.slice(end + 1).join("\n"),
      bodyLineOffset: end + 1,
    };
  }
}

async function collectMarkdownPaths(knowledgeRoot: string): Promise<string[]> {
  const paths: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const stat = await lstat(absolute);
        if (!stat.isSymbolicLink()) {
          paths.push(portable(relative(dirname(knowledgeRoot), absolute)));
        }
      }
    }
  }
  await walk(knowledgeRoot);
  return paths.sort();
}

async function requireKnowledgeRepository(targetInput: string): Promise<string> {
  const target = resolve(targetInput);
  const config = await readConfig(target);
  if (config.profile !== "knowledge") {
    throw new Error(`Knowledge command requires a knowledge repository: ${target}`);
  }
  return target;
}

function parseRelation(value: unknown): RelationInput | undefined {
  const relation = recordValue(value);
  if (!relation) {
    return undefined;
  }
  const kind = stringValue(relation.kind);
  const target = stringValue(relation.target);
  const context = stringValue(relation.context).trim();
  return kind && target && context ? { kind, target, context } : undefined;
}

function firstHeading(body: string): string {
  const match = /^#\s+(.+)$/m.exec(body);
  return match?.[1]?.trim() ?? "";
}

function graphId(path: string): string {
  return path.replace(/\.md$/i, "");
}

function deduplicateEdges(edges: KnowledgeGraphEdge[]): KnowledgeGraphEdge[] {
  const unique = new Map<string, KnowledgeGraphEdge>();
  for (const edge of edges) {
    const key = [
      edge.source,
      edge.target,
      edge.kind,
      edge.origin,
      edge.context ?? "",
    ].join("\0");
    if (!unique.has(key)) {
      unique.set(key, edge);
    }
  }
  return [...unique.values()];
}

function compareNodes(left: KnowledgeGraphNode, right: KnowledgeGraphNode): number {
  return compareText(left.id, right.id);
}

function compareEdges(left: KnowledgeGraphEdge, right: KnowledgeGraphEdge): number {
  const leftKey = [
    left.source,
    left.target,
    left.kind,
    left.origin,
    left.context ?? "",
  ].join("\0");
  const rightKey = [
    right.source,
    right.target,
    right.kind,
    right.origin,
    right.context ?? "",
  ].join("\0");
  return compareText(leftKey, rightKey);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function portable(path: string): string {
  return path.split(sep).join("/");
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

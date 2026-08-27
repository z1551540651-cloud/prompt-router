import type { Prompt } from "./types";

const SUPPORTED_KEYS = new Set(["id", "name", "description", "useWhen", "category", "keywords", "variables"]);

function cleanScalar(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseList(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && !trimmed.endsWith("]")) throw new Error("列表元数据缺少结束括号");
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return trimmed ? [cleanScalar(trimmed)] : [];
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => cleanScalar(item))
    .filter(Boolean);
}

function slugFromFileName(fileName: string): string {
  return fileName.replace(/\.md$/i, "").trim() || "untitled";
}

export function parsePromptMarkdown(fileName: string, source: string): Prompt {
  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const hasFrontmatter = lines[0]?.trim() === "---";
  let rawFrontmatter: string[] = [];
  let bodyLines = lines;

  if (hasFrontmatter) {
    const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (closingIndex !== -1) {
      rawFrontmatter = lines.slice(1, closingIndex);
      bodyLines = lines.slice(closingIndex + 1);
    }
  }

  const fields: Record<string, string | string[]> = {};
  for (const line of rawFrontmatter) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "keywords" || key === "variables") fields[key] = parseList(value);
    else if (SUPPORTED_KEYS.has(key)) fields[key] = cleanScalar(value);
  }

  const id = typeof fields.id === "string" && fields.id ? fields.id : slugFromFileName(fileName);
  const name = typeof fields.name === "string" && fields.name ? fields.name : id;
  const description = typeof fields.description === "string" ? fields.description : "";
  const useWhen = typeof fields.useWhen === "string" ? fields.useWhen : description;
  const category = typeof fields.category === "string" && fields.category ? fields.category : "未分类";
  const keywords = Array.isArray(fields.keywords) ? fields.keywords : [];
  const variables = Array.isArray(fields.variables) ? fields.variables : [];
  const body = bodyLines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");

  return { id, fileName, name, description, useWhen, category, keywords, variables, body, rawFrontmatter };
}

function formatList(values: string[]): string {
  return `[${values.map((value) => value.includes(",") ? JSON.stringify(value) : value).join(", ")}]`;
}

function upsertLine(lines: string[], key: string, value: string): string[] {
  const index = lines.findIndex((line) => line.trimStart().startsWith(`${key}:`));
  if (index === -1) return [...lines, `${key}: ${value}`];
  const next = [...lines];
  next[index] = `${key}: ${value}`;
  return next;
}

export function serializePromptMarkdown(prompt: Prompt): string {
  let frontmatter = [...prompt.rawFrontmatter];
  frontmatter = upsertLine(frontmatter, "id", prompt.id);
  frontmatter = upsertLine(frontmatter, "name", prompt.name);
  frontmatter = upsertLine(frontmatter, "description", prompt.description);
  frontmatter = upsertLine(frontmatter, "useWhen", prompt.useWhen);
  frontmatter = upsertLine(frontmatter, "category", prompt.category);
  frontmatter = upsertLine(frontmatter, "keywords", formatList(prompt.keywords));
  frontmatter = upsertLine(frontmatter, "variables", formatList(prompt.variables));
  return `---\n${frontmatter.join("\n")}\n---\n\n${prompt.body.trim()}\n`;
}

import type { Prompt, PromptSearchResult } from "./types";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN");
}

const conceptExplanationSignals = /为什么|是什么|怎么理解|原理|如何工作|怎么运作|解释一下|讲清楚/;

function isConceptExplanationPrompt(prompt: Prompt): boolean {
  const identity = normalize(`${prompt.name} ${prompt.description} ${prompt.useWhen}`);
  return prompt.category === "学习" && /解释|理解|概念/.test(identity);
}

export function matchedIntent(prompt: Prompt, query: string): string | null {
  return isConceptExplanationPrompt(prompt) && conceptExplanationSignals.test(normalize(query))
    ? "概念解释意图"
    : null;
}

export function scorePrompt(prompt: Prompt, query: string): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  const name = normalize(prompt.name);
  const category = normalize(prompt.category);
  const description = normalize(prompt.description);
  const useWhen = normalize(prompt.useWhen);
  const body = normalize(prompt.body);
  const keywords = prompt.keywords.map(normalize);
  let score = 0;

  if (name === normalizedQuery) score += 100;
  else if (name.includes(normalizedQuery)) score += 60;

  const keywordHits = keywords.filter((keyword) => keyword && (normalizedQuery.includes(keyword) || keyword.includes(normalizedQuery)));
  score += Math.min(keywordHits.length * 35, 70);
  if (category.includes(normalizedQuery) || normalizedQuery.includes(category) && category !== "未分类") score += 30;
  if (description.includes(normalizedQuery)) score += 20;
  if (useWhen.includes(normalizedQuery)) score += 20;
  if (body.includes(normalizedQuery)) score += 10;
  if (matchedIntent(prompt, normalizedQuery)) score += 70;
  return score;
}

export function searchPrompts(prompts: Prompt[], query: string): PromptSearchResult[] {
  if (!normalize(query)) return prompts.map((prompt) => ({ prompt, score: 0 }));
  return prompts
    .map((prompt) => ({ prompt, score: scorePrompt(prompt, query) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.prompt.name.localeCompare(right.prompt.name, "zh-CN"));
}

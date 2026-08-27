import type { Prompt, PromptSearchResult } from "./types";
import { containsPhrase, normalizeRouteText, sharedNgramScore } from "./route-signals";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN");
}

const GENERIC_WORDS = new Set(["问题", "方案", "产品", "设计", "决定", "行业", "数据", "专业"]);
const INTENT_LABELS: Record<string, string> = {
  "clarify-question": "问清问题意图",
  "concept-explanation": "概念解释意图",
  "reverse-deconstruction": "反向拆解意图",
  research: "系统研究意图",
  "fact-checking": "事实核查意图",
  "multi-perspective-solution": "多视角解决问题意图",
  "first-principles": "第一性原理意图",
  "cross-domain-solution": "跨领域借解意图",
  decision: "选择决策意图",
  "minimum-experiment": "最小实验意图",
  "self-understanding": "自我认识意图",
  "life-direction": "人生方向意图",
};

function exampleAffinity(prompt: Prompt, query: string): number {
  return Math.max(0, ...(prompt.positiveExamples ?? []).map((example) => {
    if (containsPhrase(query, example)) return 1;
    return sharedNgramScore(query, example);
  }));
}

export function matchedIntent(prompt: Prompt, query: string): string | null {
  const affinity = exampleAffinity(prompt, normalizeRouteText(query));
  if (!prompt.intent || affinity < 0.35) return null;
  return INTENT_LABELS[prompt.intent] ?? `${prompt.intent}意图`;
}

export function scorePrompt(prompt: Prompt, query: string): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  const name = normalize(prompt.name);
  const category = normalize(prompt.category);
  const description = normalize(prompt.description);
  const useWhen = normalize(prompt.useWhen);
  const body = normalize(prompt.body);
  const keywords = prompt.keywords.map(normalizeRouteText);
  let score = 0;

  if (name === normalizedQuery) score += 100;
  else if (name.includes(normalizedQuery)) score += 60;

  const normalizedRouteQuery = normalizeRouteText(query);
  const positiveExampleScore = Math.max(0, ...(prompt.positiveExamples ?? []).map((example) => {
    if (containsPhrase(normalizedRouteQuery, example)) return 120;
    const affinity = sharedNgramScore(normalizedRouteQuery, example);
    return affinity >= 0.35 ? Math.round(affinity * 60) : 0;
  }));
  const negativeExamplePenalty = (prompt.negativeExamples ?? []).reduce((total, example) => {
    if (containsPhrase(normalizedRouteQuery, example)) return total + 140;
    const affinity = sharedNgramScore(normalizedRouteQuery, example);
    return total + (affinity >= 0.6 ? Math.round(affinity * 70) : 0);
  }, 0);
  score += positiveExampleScore - negativeExamplePenalty;

  const keywordHits = keywords.filter((keyword) => keyword && (normalizedRouteQuery.includes(keyword) || keyword.includes(normalizedRouteQuery)));
  score += Math.min(keywordHits.reduce((total, keyword) => total + (GENERIC_WORDS.has(keyword) ? 8 : 25), 0), 70);
  if (category.includes(normalizedQuery) || normalizedQuery.includes(category) && category !== "未分类") score += 30;
  if (description.includes(normalizedQuery)) score += 20;
  if (useWhen.includes(normalizedQuery)) score += 20;
  if (body.includes(normalizedQuery)) score += 10;
  return Math.max(0, score);
}

export function searchPrompts(prompts: Prompt[], query: string): PromptSearchResult[] {
  if (!normalize(query)) return prompts.map((prompt) => ({ prompt, score: 0 }));
  return prompts
    .map((prompt) => ({ prompt, score: scorePrompt(prompt, query) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.prompt.name.localeCompare(right.prompt.name, "zh-CN"));
}

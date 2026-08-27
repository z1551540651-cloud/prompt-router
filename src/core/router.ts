import { matchedIntent, searchPrompts } from "./search";
import type { Prompt, RouteCandidate, RouteProvider, RouteResult } from "./types";

function reasonFor(prompt: Prompt, question: string, score: number): string {
  const lowerQuestion = question.toLocaleLowerCase("zh-CN");
  const intent = matchedIntent(prompt, question);
  if (intent) return `识别到${intent}`;
  const hits = prompt.keywords.filter((keyword) => lowerQuestion.includes(keyword.toLocaleLowerCase("zh-CN")));
  if (hits.length) return `命中关键词：${hits.join("、")}`;
  if (prompt.name.toLocaleLowerCase("zh-CN").includes(lowerQuestion)) return "匹配提示词名称";
  if (prompt.category && lowerQuestion.includes(prompt.category.toLocaleLowerCase("zh-CN"))) return `匹配分类：${prompt.category}`;
  if (prompt.useWhen && prompt.useWhen.toLocaleLowerCase("zh-CN").includes(lowerQuestion)) return "匹配适用场景";
  if (score > 0) return "匹配提示词描述或正文";
  return "本地规则没有找到高置信度匹配";
}

function localCandidates(question: string, prompts: Prompt[]): RouteCandidate[] {
  const searched = searchPrompts(prompts, question);
  if (searched.length) {
    return searched.slice(0, 3).map(({ prompt, score }) => ({ prompt, score, reason: reasonFor(prompt, question, score) }));
  }
  return [];
}

function localResult(question: string, prompts: Prompt[]): RouteResult {
  if (!prompts.length) return { status: "unavailable", candidates: [], providerUsed: false };
  const candidates = localCandidates(question, prompts);
  const topScore = candidates[0]?.score ?? 0;
  const secondScore = candidates[1]?.score ?? 0;
  const confident = topScore >= 80 || topScore >= 45 && topScore - secondScore >= 25;
  return { status: confident ? "matched" : "needsManualChoice", candidates, providerUsed: false };
}

export async function routeQuestion(question: string, prompts: Prompt[], provider?: RouteProvider): Promise<RouteResult> {
  const local = localResult(question, prompts);
  if (local.status === "matched" || !provider) return local;

  try {
    const ids = await provider.classify(question, prompts);
    const byId = new Map(prompts.map((prompt) => [prompt.id, prompt]));
    const candidates = ids
      .map((id) => byId.get(id))
      .filter((prompt): prompt is Prompt => Boolean(prompt))
      .slice(0, 3)
      .map((prompt) => ({ prompt, score: 100, reason: "AI 路由建议" }));
    if (candidates.length) return { status: "matched", candidates, providerUsed: true };
  } catch {
    // A provider is an optional accelerator. Local/manual routing remains available.
  }

  return local;
}

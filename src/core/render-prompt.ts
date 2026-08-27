import type { Prompt, PromptVariables } from "./types";

export function renderPrompt(prompt: Prompt, variables: PromptVariables = {}, question = ""): string {
  let body = prompt.body;
  const trimmedQuestion = question.trim();
  const values = { ...variables };
  if (trimmedQuestion && prompt.primaryVariable && !values[prompt.primaryVariable]) {
    values[prompt.primaryVariable] = trimmedQuestion;
  }
  if (!trimmedQuestion && !Object.keys(values).length) return body.trim();

  let questionInserted = false;
  for (const [name, value] of Object.entries(values)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const chinesePattern = new RegExp(`【${escapedName}】`, "g");
    const doubleBracePattern = new RegExp(`\\{\\{${escapedName}\\}\\}`, "g");
    const before = body;
    body = body.replace(chinesePattern, value).replace(doubleBracePattern, value);
    if (trimmedQuestion && value === trimmedQuestion && body !== before) questionInserted = true;
  }

  if (trimmedQuestion && prompt.primaryVariable && !questionInserted) {
    const firstPlaceholder = /【[^】]+】|\{\{[^}]+\}\}/;
    if (firstPlaceholder.test(body)) {
      body = body.replace(firstPlaceholder, trimmedQuestion);
      questionInserted = true;
    }
  }

  body = body.replace(/【[^】]+】/g, "（暂未提供）").replace(/\{\{[^}]+\}\}/g, "（暂未提供）");
  return trimmedQuestion && !questionInserted ? `${body.trim()}\n\n用户问题：${trimmedQuestion}` : body.trim();
}

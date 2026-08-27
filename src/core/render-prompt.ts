import type { Prompt, PromptVariables } from "./types";

export function renderPrompt(prompt: Prompt, variables: PromptVariables = {}, question = ""): string {
  let body = prompt.body;
  for (const [name, value] of Object.entries(variables)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp(`【${escapedName}】`, "g"), value).replace(new RegExp(`\\{\\{${escapedName}\\}\\}`, "g"), value);
  }
  const trimmedQuestion = question.trim();
  return trimmedQuestion ? `${body.trim()}\n\n用户问题：${trimmedQuestion}` : body.trim();
}

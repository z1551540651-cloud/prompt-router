import type { Prompt } from "./types";

export function applyRoutingDefaults(prompt: Prompt, defaults?: Prompt): Prompt {
  if (!defaults) return prompt;
  return {
    ...prompt,
    intent: prompt.intent ?? defaults.intent,
    positiveExamples: prompt.positiveExamples ?? defaults.positiveExamples,
    negativeExamples: prompt.negativeExamples ?? defaults.negativeExamples,
    primaryVariable: prompt.primaryVariable ?? defaults.primaryVariable,
  };
}

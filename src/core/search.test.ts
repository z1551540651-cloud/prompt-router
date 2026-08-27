import { describe, expect, it } from "vitest";
import type { Prompt } from "./types";
import { searchPrompts } from "./search";

function prompt(overrides: Partial<Prompt>): Prompt {
  return {
    id: "demo",
    fileName: "demo.md",
    name: "普通提示词",
    description: "一个普通模板",
    useWhen: "适用于普通情况",
    category: "其他",
    keywords: [],
    variables: [],
    body: "普通内容",
    rawFrontmatter: [],
    ...overrides,
  };
}

describe("prompt search", () => {
  it("returns all prompts for an empty query", () => {
    const results = searchPrompts([prompt({ id: "a" }), prompt({ id: "b" })], "");
    expect(results).toHaveLength(2);
  });

  it("ranks exact name, keyword, and body matches in that order", () => {
    const results = searchPrompts(
      [
        prompt({ id: "body", body: "双向钢人论证" }),
        prompt({ id: "keyword", keywords: ["双向钢人论证"] }),
        prompt({ id: "exact", name: "双向钢人论证" }),
      ],
      "双向钢人论证",
    );

    expect(results.map((item) => item.prompt.id)).toEqual(["exact", "keyword", "body"]);
  });

  it("prefers a declared intent example over generic words", () => {
    const results = searchPrompts(
      [
        prompt({
          id: "decision",
          name: "双向钢人论证",
          intent: "decision",
          positiveExamples: ["我在两个方案之间犹豫不知道选哪个"],
          negativeExamples: ["请解释这个概念"],
          keywords: ["方案", "选择"],
        }),
        prompt({
          id: "expert",
          name: "专家会诊",
          intent: "multi-perspective-solution",
          keywords: ["方案", "问题"],
        }),
      ],
      "我在两个方案之间犹豫不知道选哪个",
    );

    expect(results[0]?.prompt.id).toBe("decision");
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it("penalizes a candidate when the query matches its negative example", () => {
    const results = searchPrompts(
      [
        prompt({ id: "concept", intent: "concept-explanation", positiveExamples: ["解释一个陌生概念"], negativeExamples: ["要不要买这个产品"] }),
        prompt({ id: "decision", intent: "decision", positiveExamples: ["要不要买这个产品"] }),
      ],
      "要不要买这个产品",
    );

    expect(results[0]?.prompt.id).toBe("decision");
  });
});

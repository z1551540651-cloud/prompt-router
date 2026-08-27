import { describe, expect, it } from "vitest";
import type { Prompt } from "./types";
import { applyRoutingDefaults } from "./routing-defaults";

function prompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "demo",
    fileName: "demo.md",
    name: "用户修改后的名称",
    description: "用户说明",
    useWhen: "用户场景",
    category: "用户分类",
    keywords: ["用户关键词"],
    variables: [],
    body: "用户修改后的正文",
    rawFrontmatter: [],
    ...overrides,
  };
}

describe("routing metadata defaults", () => {
  it("fills missing routing metadata without replacing user content", () => {
    const existing = prompt();
    const bundled = prompt({
      name: "内置名称",
      body: "内置正文",
      intent: "decision",
      positiveExamples: ["两个选项怎么选"],
      negativeExamples: ["解释一个概念"],
      primaryVariable: "问题",
    });

    const merged = applyRoutingDefaults(existing, bundled);

    expect(merged).toMatchObject({
      name: "用户修改后的名称",
      body: "用户修改后的正文",
      keywords: ["用户关键词"],
      intent: "decision",
      positiveExamples: ["两个选项怎么选"],
      negativeExamples: ["解释一个概念"],
      primaryVariable: "问题",
    });
  });

  it("keeps routing metadata explicitly provided by the user", () => {
    const existing = prompt({ intent: "custom", positiveExamples: [], primaryVariable: "自定义字段" });
    const bundled = prompt({ intent: "decision", positiveExamples: ["默认示例"], primaryVariable: "问题" });

    const merged = applyRoutingDefaults(existing, bundled);

    expect(merged.intent).toBe("custom");
    expect(merged.positiveExamples).toEqual([]);
    expect(merged.primaryVariable).toBe("自定义字段");
  });
});

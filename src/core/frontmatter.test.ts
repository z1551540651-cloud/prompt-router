import { describe, expect, it } from "vitest";
import { parsePromptMarkdown, serializePromptMarkdown } from "./frontmatter";

describe("prompt markdown frontmatter", () => {
  it("parses supported fields and preserves the body", () => {
    const prompt = parsePromptMarkdown(
      "decision.md",
      "---\nid: decision\nname: 双向钢人论证\ndescription: 比较两个方向\ncategory: 决策\nkeywords: [犹豫, 选择]\nvariables: [问题, 目标]\n---\n\n正文【问题】",
    );

    expect(prompt).toMatchObject({
      id: "decision",
      fileName: "decision.md",
      name: "双向钢人论证",
      description: "比较两个方向",
      useWhen: "比较两个方向",
      category: "决策",
      keywords: ["犹豫", "选择"],
      variables: ["问题", "目标"],
      body: "正文【问题】",
    });
  });

  it("derives defaults when frontmatter is missing", () => {
    const prompt = parsePromptMarkdown("hello-world.md", "普通正文");

    expect(prompt).toMatchObject({
      id: "hello-world",
      fileName: "hello-world.md",
      name: "hello-world",
      description: "",
      useWhen: "",
      category: "未分类",
      keywords: [],
      variables: [],
      body: "普通正文",
    });
  });

  it("keeps unknown frontmatter lines when serializing", () => {
    const original = "---\nid: demo\nname: 原名\ncustom: keep-me\n---\n\n正文";
    const parsed = parsePromptMarkdown("demo.md", original);
    const serialized = serializePromptMarkdown({ ...parsed, name: "新名" });

    expect(serialized).toContain("custom: keep-me");
    expect(serialized).toContain("name: 新名");
    expect(serialized).toContain("正文");
  });

  it("parses optional routing metadata", () => {
    const prompt = parsePromptMarkdown("demo.md", `---
id: demo
name: 示例
intent: decision
positiveExamples: [我该不该买, 两个方案怎么选]
negativeExamples: [请解释这个概念]
primaryVariable: 决定
---

正文`);

    expect(prompt.intent).toBe("decision");
    expect(prompt.positiveExamples).toEqual(["我该不该买", "两个方案怎么选"]);
    expect(prompt.negativeExamples).toEqual(["请解释这个概念"]);
    expect(prompt.primaryVariable).toBe("决定");
  });

  it("keeps old prompts compatible when routing metadata is absent", () => {
    const prompt = parsePromptMarkdown("old.md", "---\nid: old\nname: 旧模板\n---\n\n正文");

    expect(prompt.intent).toBeUndefined();
    expect(prompt.positiveExamples).toBeUndefined();
    expect(prompt.negativeExamples).toBeUndefined();
    expect(prompt.primaryVariable).toBeUndefined();
  });

  it("serializes routing metadata without dropping existing frontmatter", () => {
    const source = parsePromptMarkdown("demo.md", `---
id: demo
name: 示例
intent: decision
positiveExamples: [我该不该买]
negativeExamples: [解释概念]
primaryVariable: 决定
---

正文`);
    const serialized = serializePromptMarkdown(source);

    expect(serialized).toContain("intent: decision");
    expect(serialized).toContain("positiveExamples: [我该不该买]");
    expect(serialized).toContain("negativeExamples: [解释概念]");
    expect(serialized).toContain("primaryVariable: 决定");
  });
});

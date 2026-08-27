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
});

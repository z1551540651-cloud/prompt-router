import { describe, expect, it } from "vitest";
import { renderPrompt } from "./render-prompt";
import type { Prompt } from "./types";

const sample: Prompt = {
  id: "demo",
  fileName: "demo.md",
  name: "模板",
  description: "",
  useWhen: "适用于测试",
  category: "测试",
  keywords: [],
  variables: ["问题", "目标"],
  body: "请分析【问题】，目标是 {{目标}}。保留【未填写】。",
  rawFrontmatter: [],
};

describe("renderPrompt", () => {
  it("replaces Chinese and double-brace variables", () => {
    expect(renderPrompt(sample, { 问题: "显示器怎么选", 目标: "买对" }, "")).toBe("请分析显示器怎么选，目标是 买对。保留【未填写】。");
  });

  it("adds the user question after the prompt body", () => {
    expect(renderPrompt(sample, {}, "我该选哪个？")).toContain("用户问题：我该选哪个？");
  });
});

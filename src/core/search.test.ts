import { describe, expect, it } from "vitest";
import type { Prompt } from "./types";
import { searchPrompts } from "./search";

function prompt(overrides: Partial<Prompt>): Prompt {
  return {
    id: "demo",
    fileName: "demo.md",
    name: "普通提示词",
    description: "一个普通模板",
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
});

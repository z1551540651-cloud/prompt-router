import { describe, expect, it } from "vitest";
import { routeQuestion } from "./router";
import type { Prompt, RouteProvider } from "./types";

function prompt(overrides: Partial<Prompt>): Prompt {
  return {
    id: "demo",
    fileName: "demo.md",
    name: "普通模板",
    description: "普通模板",
    useWhen: "适用于普通情况",
    category: "其他",
    keywords: [],
    variables: [],
    body: "普通正文",
    rawFrontmatter: [],
    ...overrides,
  };
}

const steelman = prompt({
  id: "two-sided-steelman",
  name: "双向钢人论证",
  useWhen: "适用于购物对比和两个选项难分高下",
  category: "决策",
  keywords: ["犹豫", "选择", "决定"],
});

const twoLayer = prompt({
  id: "two-layer-explanation",
  name: "双层解释法",
  description: "用小白版和专业版解释一个陌生概念",
  useWhen: "适用于看不懂技术、概念或名词，想从小白到专业理解的情况",
  category: "学习",
  keywords: ["学习", "概念", "听不懂", "解释", "小白", "专业"],
  intent: "concept-explanation",
  positiveExamples: ["地球为什么是圆的"],
});

describe("hybrid prompt router", () => {
  it("recognizes a decision question with local rules", async () => {
    const result = await routeQuestion("我在两个选择之间犹豫，今天要做决定", [steelman, prompt({ id: "other" })]);

    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.prompt.id).toBe("two-sided-steelman");
    expect(result.providerUsed).toBe(false);
  });

  it("asks for manual choice when confidence is low", async () => {
    const result = await routeQuestion("我想吃点东西", [steelman, prompt({ id: "other" })]);

    expect(result.status).toBe("needsManualChoice");
  });

  it("recognizes a shopping comparison question", async () => {
    const shoppingPrompt = { ...steelman, keywords: [...steelman.keywords, "购物", "买什么", "怎么选", "显示器"] };
    const result = await routeQuestion("我想买显示器，不知道怎么选", [shoppingPrompt, prompt({ id: "other" })]);

    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.prompt.id).toBe("two-sided-steelman");
  });

  it("recognizes a general why question as a concept explanation", async () => {
    const result = await routeQuestion("地球为什么是圆的", [twoLayer, steelman]);

    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.prompt.id).toBe("two-layer-explanation");
    expect(result.candidates[0]?.reason).toBe("识别到概念解释意图");
  });

  it("uses provider ids when local rules are inconclusive", async () => {
    const provider: RouteProvider = {
      classify: async () => ["two-sided-steelman"],
    };
    const result = await routeQuestion("帮我处理一个复杂问题", [steelman], provider);

    expect(result.status).toBe("matched");
    expect(result.candidates[0]?.prompt.id).toBe("two-sided-steelman");
    expect(result.providerUsed).toBe(true);
  });

  it("falls back to local candidates when provider fails", async () => {
    const provider: RouteProvider = {
      classify: async () => { throw new Error("network down"); },
    };
    const result = await routeQuestion("我想吃点东西", [steelman, prompt({ id: "other" })], provider);

    expect(result.status).toBe("needsManualChoice");
    expect(result.providerUsed).toBe(false);
  });

  it("returns no candidates when local rules have no evidence", async () => {
    const result = await routeQuestion("今天晚上吃什么", [twoLayer, steelman]);

    expect(result.status).toBe("needsManualChoice");
    expect(result.candidates).toEqual([]);
  });
});

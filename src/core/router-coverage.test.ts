import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePromptMarkdown } from "./frontmatter";
import { renderPrompt } from "./render-prompt";
import { routeQuestion } from "./router";

type ClearCase = { expected: string; question: string };

const clearCases: ClearCase[] = [
  { expected: "socratic-questioning", question: "我不知道该怎么描述现在的困境" },
  { expected: "socratic-questioning", question: "我说不清自己到底卡在哪里" },
  { expected: "socratic-questioning", question: "我好像把事实和自己的判断混在一起了" },
  { expected: "socratic-questioning", question: "这件事该从哪里问起" },
  { expected: "socratic-questioning", question: "脑子里很乱但不知道真正的问题是什么" },
  { expected: "socratic-questioning", question: "先别给建议 帮我把问题问清楚" },
  { expected: "socratic-questioning", question: "我有很多困惑却组织不成一个明确问题" },
  { expected: "socratic-questioning", question: "能不能通过追问帮我找到真正想解决的事" },

  { expected: "two-layer-explanation", question: "地球为什么是圆的" },
  { expected: "two-layer-explanation", question: "Docker 是怎么工作的" },
  { expected: "two-layer-explanation", question: "量子纠缠到底是什么" },
  { expected: "two-layer-explanation", question: "用小白能听懂的话解释区块链" },
  { expected: "two-layer-explanation", question: "数据库索引的原理是什么" },
  { expected: "two-layer-explanation", question: "我听不懂 API 网关这个名词" },
  { expected: "two-layer-explanation", question: "Transformer 是如何工作的" },
  { expected: "two-layer-explanation", question: "先生活化再专业地讲清楚机会成本" },

  { expected: "reverse-deconstruction", question: "给我分析这份成品方案的结构" },
  { expected: "reverse-deconstruction", question: "我想拆解竞品页面的设计方法" },
  { expected: "reverse-deconstruction", question: "想从一个优秀 App 学会它怎么做" },
  { expected: "reverse-deconstruction", question: "帮我拆开这个优秀网站背后的结构和关键选择" },
  { expected: "reverse-deconstruction", question: "这个爆款视频为什么有效 我想学会它的做法" },
  { expected: "reverse-deconstruction", question: "从成品反推它的制作流程" },
  { expected: "reverse-deconstruction", question: "我想模仿这个产品页面 请提炼可复用规律" },
  { expected: "reverse-deconstruction", question: "分析这个数据看板是怎么设计出来的" },

  { expected: "horizontal-vertical-analysis", question: "对比不同数据库技术并追溯历史" },
  { expected: "horizontal-vertical-analysis", question: "想系统研究这个行业" },
  { expected: "horizontal-vertical-analysis", question: "调研几家公司的差异和发展" },
  { expected: "horizontal-vertical-analysis", question: "梳理这家公司从成立到现在的发展并和对手比较" },
  { expected: "horizontal-vertical-analysis", question: "研究 AI 搜索产品的历史演化和当前格局" },
  { expected: "horizontal-vertical-analysis", question: "做竞品横向比较也要追溯各自来路" },
  { expected: "horizontal-vertical-analysis", question: "这个技术过去怎么发展 现在有哪些主要玩家" },
  { expected: "horizontal-vertical-analysis", question: "帮我做一份有来源的行业深度调研" },

  { expected: "fact-checking", question: "这条新闻是真的吗" },
  { expected: "fact-checking", question: "我想判断一个结论靠不靠谱" },
  { expected: "fact-checking", question: "这个方案的依据是什么" },
  { expected: "fact-checking", question: "这个数据有没有证据" },
  { expected: "fact-checking", question: "这个观点是否事实准确" },
  { expected: "fact-checking", question: "帮我核查这句话" },
  { expected: "fact-checking", question: "网上这个说法可信到什么程度" },
  { expected: "fact-checking", question: "请区分这里哪些是事实哪些只是推断" },

  { expected: "expert-consultation", question: "我的问题同时涉及产品技术运营和风险" },
  { expected: "expert-consultation", question: "这个方案需要多个专业视角" },
  { expected: "expert-consultation", question: "解决一个复杂问题要考虑资源和风险" },
  { expected: "expert-consultation", question: "这个决定技术和商业都重要" },
  { expected: "expert-consultation", question: "评估项目落地需要哪些方面" },
  { expected: "expert-consultation", question: "这个问题很复杂不想只听单一建议" },
  { expected: "expert-consultation", question: "这件事牵涉法律技术成本和执行 请综合判断" },
  { expected: "expert-consultation", question: "需要不同专业角度互相质疑后给方案" },

  { expected: "first-principles", question: "不要沿用惯例重新推导这个方案" },
  { expected: "first-principles", question: "这个架构一直打补丁想回到底层事实" },
  { expected: "first-principles", question: "帮我找出真正目标和假设" },
  { expected: "first-principles", question: "为什么这个流程需要这么多步骤能否从基本事实重来" },
  { expected: "first-principles", question: "重新设计系统架构" },
  { expected: "first-principles", question: "从最基本的原理想想" },
  { expected: "first-principles", question: "先放下现成做法 从不可绕开的事实重新推演" },
  { expected: "first-principles", question: "这个系统越改越复杂 我想回到本质重做" },

  { expected: "cross-domain-solution", question: "常规办法失效想借用游戏设计解决运营问题" },
  { expected: "cross-domain-solution", question: "能否用航空业的安全机制解决剪辑流程" },
  { expected: "cross-domain-solution", question: "把这个问题抽象成底层结构再类比" },
  { expected: "cross-domain-solution", question: "运营卡点想跨行业找灵感" },
  { expected: "cross-domain-solution", question: "不要行业术语帮我寻找结构相似的问题" },
  { expected: "cross-domain-solution", question: "用其他领域解法突破当前瓶颈" },
  { expected: "cross-domain-solution", question: "本行业的方法都试过了 想看看别的领域怎么解决同类矛盾" },
  { expected: "cross-domain-solution", question: "从医疗军事和生态系统里找可迁移的机制" },

  { expected: "two-sided-steelman", question: "要不要换电脑" },
  { expected: "two-sided-steelman", question: "两个方案都有道理不知道选哪个" },
  { expected: "two-sided-steelman", question: "这个产品值不值得买" },
  { expected: "two-sided-steelman", question: "我在两个选项之间犹豫" },
  { expected: "two-sided-steelman", question: "购物对比不知道怎么选" },
  { expected: "two-sided-steelman", question: "换不换显示器" },
  { expected: "two-sided-steelman", question: "A 和 B 都有优势 帮我把两边最强理由讲清楚" },
  { expected: "two-sided-steelman", question: "我在留在现公司和跳槽之间拿不定主意" },

  { expected: "minimum-experiment", question: "我不确定要不要买这件东西能不能先试试" },
  { expected: "minimum-experiment", question: "我在做不做之间犹豫先设计最小实验" },
  { expected: "minimum-experiment", question: "不想空想先做个小测试" },
  { expected: "minimum-experiment", question: "这个决定能先小规模试运行吗" },
  { expected: "minimum-experiment", question: "先低成本验证再决定" },
  { expected: "minimum-experiment", question: "有什么可逆的试错办法" },
  { expected: "minimum-experiment", question: "先别做长期承诺 帮我安排一个七天验证" },
  { expected: "minimum-experiment", question: "我有个创业想法 想用最小成本看看有没有人需要" },

  { expected: "hidden-talents", question: "我想知道自己真正擅长什么" },
  { expected: "hidden-talents", question: "帮我挖掘职业天赋" },
  { expected: "hidden-talents", question: "我不知道自己适合什么工作" },
  { expected: "hidden-talents", question: "想发现被忽视的优势" },
  { expected: "hidden-talents", question: "哪些事情是我的无意识优势" },
  { expected: "hidden-talents", question: "我想了解自己的心流和能量模式" },
  { expected: "hidden-talents", question: "哪些事我做起来很轻松别人却觉得难" },
  { expected: "hidden-talents", question: "想从过去的心流经历里找到可迁移能力" },

  { expected: "life-design", question: "想做三个不同的人生方案" },
  { expected: "life-design", question: "我对未来工作和生活方向迷茫" },
  { expected: "life-design", question: "不知道未来该走哪条路" },
  { expected: "life-design", question: "想设计五年后的生活" },
  { expected: "life-design", question: "对人生方向没有头绪" },
  { expected: "life-design", question: "我想重新规划职业和生活" },
  { expected: "life-design", question: "工作生活都很迷茫 想看看未来五年有哪些可能" },
  { expected: "life-design", question: "如果当前道路消失 我还能设计怎样的人生" },
];

const ambiguousQuestions = ["今天晚上吃什么", "帮我写一句祝福", "现在几点", "你好"];

function loadBundledPrompts() {
  const directory = resolve(process.cwd(), "prompts");
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => parsePromptMarkdown(fileName, readFileSync(resolve(directory, fileName), "utf8")));
}

describe("100-question local router coverage", () => {
  it("routes broad learning requests to the two-layer explanation prompt", async () => {
    const prompts = loadBundledPrompts();

    for (const question of ["我想学金融知识", "我想学习摄影基础"]) {
      const result = await routeQuestion(question, prompts);
      expect(result.status, question).toBe("matched");
      expect(result.candidates[0]?.prompt.id, question).toBe("two-layer-explanation");
    }
  });

  it("routes at least 90 of 96 clear questions with high confidence", async () => {
    const prompts = loadBundledPrompts();
    const results = await Promise.all(clearCases.map(async (item) => ({
      ...item,
      result: await routeQuestion(item.question, prompts),
    })));
    const mismatches = results.filter(({ expected, result }) => result.status !== "matched" || result.candidates[0]?.prompt.id !== expected);
    const correct = results.length - mismatches.length;
    const details = mismatches.map(({ question, expected, result }) => {
      const candidates = result.candidates.map((candidate) => `${candidate.prompt.id}:${candidate.score}`).join(",");
      return `${question} | expected=${expected} actual=${result.candidates[0]?.prompt.id ?? "none"} status=${result.status} candidates=[${candidates}]`;
    }).join("\n");

    if (process.env.ROUTER_REPORT === "1") {
      console.info(`ROUTER_CLEAR=${correct}/96`);
      if (details) console.info(details);
    }

    expect(clearCases).toHaveLength(96);
    expect(correct, details).toBeGreaterThanOrEqual(90);
  });

  it("abstains on all four ambiguous questions", async () => {
    const prompts = loadBundledPrompts();
    const results = await Promise.all(ambiguousQuestions.map((question) => routeQuestion(question, prompts)));

    if (process.env.ROUTER_REPORT === "1") {
      console.info(`ROUTER_AMBIGUOUS=${results.filter((result) => result.status === "needsManualChoice").length}/4`);
    }

    expect(results.every((result) => result.status === "needsManualChoice")).toBe(true);
  });

  it("renders the routed question without raw placeholders", () => {
    const prompts = loadBundledPrompts();
    const prompt = prompts.find((item) => item.id === "two-layer-explanation");
    expect(prompt).toBeDefined();

    const rendered = renderPrompt(prompt!, {}, "地球为什么是圆的");
    expect(rendered).toContain("地球为什么是圆的");
    expect(rendered).not.toMatch(/【[^】]+】|\{\{[^}]+\}\}/);
  });
});

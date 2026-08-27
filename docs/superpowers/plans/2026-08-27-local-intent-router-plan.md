# Local Intent Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the 12-prompt local router from keyword scoring to explainable intent matching and generate a filled, copy-ready prompt without API keys.

**Architecture:** Prompt Markdown files remain the editable source of truth. Frontmatter supplies intent metadata, positive examples, negative examples, and the primary variable to fill. A pure TypeScript local scorer ranks candidates, abstains when confidence is low, and a single prompt renderer produces the preview/copy text used by both search and route modes.

**Tech Stack:** Electron, TypeScript, native HTML/CSS, Vitest, pnpm.

---

## File map

- Modify `src/core/types.ts`: add optional routing metadata while keeping old Markdown files loadable.
- Modify `src/core/frontmatter.ts`: parse and serialize the new scalar/list metadata.
- Modify `src/core/frontmatter.test.ts`: protect backward compatibility and round trips.
- Modify the 12 files under `prompts/`: add intent metadata and primary variables.
- Create `src/core/route-signals.ts`: normalize query text and define low-level phrase/negative-signal helpers.
- Modify `src/core/search.ts`: use metadata and contrastive scoring; remove the concept-only special case from the router.
- Modify `src/core/search.test.ts`: test strong intent evidence, generic-word resistance, and negative evidence.
- Modify `src/core/router.ts`: return honest manual-choice candidates without pretending zero-score prompts are matches.
- Modify `src/core/router.test.ts`: test confidence boundaries and no-evidence behavior.
- Modify `src/core/render-prompt.ts`: compile a routed question into the primary variable and visibly mark missing fields.
- Modify `src/core/render-prompt.test.ts`: test primary-variable filling and unresolved placeholders.
- Create `src/core/router-coverage.test.ts`: run the fixed 100-question regression set against the real bundled prompt files.
- Modify `index.html`: add a prompt preview region.
- Modify `styles.css`: style the preview and no-confidence state.
- Modify `src/renderer.ts`: use the core renderer, show preview, and copy only after confirmation.
- Modify `README.md`: document the local-only matching and copy flow.
- Modify `package.json`: increment the app version after all tests pass.

### Task 1: Add editable routing metadata

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/frontmatter.ts`
- Test: `src/core/frontmatter.test.ts`
- Modify: `prompts/01-socratic-questioning.md` through `prompts/12-life-design.md`

- [ ] **Step 1: Write failing frontmatter tests**

Add these cases to `src/core/frontmatter.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing fields**

Run: `pnpm vitest run src/core/frontmatter.test.ts`

Expected: FAIL because `Prompt` and the parser do not yet expose `intent`, the example lists, or `primaryVariable`.

- [ ] **Step 3: Add optional fields and parser support**

Extend `Prompt` in `src/core/types.ts` with:

```ts
  intent?: string;
  positiveExamples?: string[];
  negativeExamples?: string[];
  primaryVariable?: string;
```

Extend `SUPPORTED_KEYS` in `src/core/frontmatter.ts` with `intent`, `positiveExamples`, `negativeExamples`, and `primaryVariable`. Parse `positiveExamples` and `negativeExamples` with the existing `parseList`; parse the other two values as scalars. Return the optional values only when present, and update `serializePromptMarkdown` with `upsertLine` for every field so existing user-edited frontmatter remains intact.

- [ ] **Step 4: Add metadata to the bundled prompts**

Use these exact values in each file’s frontmatter:

| File | `intent` | `primaryVariable` |
|---|---|---|
| `01-socratic-questioning.md` | `clarify-question` | `困惑` |
| `02-two-layer-explanation.md` | `concept-explanation` | `概念或问题` |
| `03-reverse-deconstruction.md` | `reverse-deconstruction` | `优秀范例` |
| `04-horizontal-vertical-analysis.md` | `research` | `研究对象` |
| `05-fact-checking.md` | `fact-checking` | `说法` |
| `06-expert-consultation.md` | `multi-perspective-solution` | `问题、已知事实、目标和现实约束` |
| `07-first-principles.md` | `first-principles` | `问题` |
| `08-cross-domain-solution.md` | `cross-domain-solution` | `背景、当前做法、现实约束和具体卡点` |
| `09-two-sided-steelman.md` | `decision` | `决定、两个选项、目标和现实约束` |
| `10-minimum-experiment.md` | `minimum-experiment` | `选择或想法` |
| `11-hidden-talents.md` | `self-understanding` | `问题` |
| `12-life-design.md` | `life-direction` | `问题` |

Each file must also receive 5–8 complete `positiveExamples` and 2–4 `negativeExamples` that cover natural Chinese wording and the nearest confusing prompt. Keep examples free of commas so the current list parser preserves each item.

- [ ] **Step 5: Run frontmatter tests and commit the metadata layer**

Run: `pnpm vitest run src/core/frontmatter.test.ts`

Expected: PASS with the original tests plus the new metadata cases.

Commit: `git add src/core/types.ts src/core/frontmatter.ts src/core/frontmatter.test.ts prompts && git commit -m "feat: add editable prompt routing metadata"`

### Task 2: Replace keyword-only scoring with contrastive local intent scoring

**Files:**
- Create: `src/core/route-signals.ts`
- Modify: `src/core/search.ts`
- Test: `src/core/search.test.ts`
- Modify: `src/core/router.ts`
- Test: `src/core/router.test.ts`

- [ ] **Step 1: Write failing scorer tests**

Add these tests to `src/core/search.test.ts` using the existing `prompt()` helper:

```ts
it("prefers a declared intent and positive example over generic words", () => {
  const results = searchPrompts([
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
  ], "我在两个方案之间犹豫不知道选哪个");

  expect(results[0]?.prompt.id).toBe("decision");
  expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
});

it("penalizes a candidate when the query matches its negative example", () => {
  const results = searchPrompts([
    prompt({ id: "concept", intent: "concept-explanation", positiveExamples: ["解释一个陌生概念"], negativeExamples: ["要不要买这个产品"] }),
    prompt({ id: "decision", intent: "decision", positiveExamples: ["要不要买这个产品"] }),
  ], "要不要买这个产品");

  expect(results[0]?.prompt.id).toBe("decision");
});
```

Add this test to `src/core/router.test.ts`:

```ts
it("does not call zero-score prompts a match when no local evidence exists", async () => {
  const result = await routeQuestion("今天晚上吃什么", [twoLayer, steelman]);

  expect(result.status).toBe("needsManualChoice");
  expect(result.candidates.every((candidate) => candidate.score > 0)).toBe(false);
  expect(result.candidates.every((candidate) => candidate.reason === "本地规则没有找到高置信度匹配")).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail for the old scorer**

Run: `pnpm vitest run src/core/search.test.ts src/core/router.test.ts`

Expected: FAIL because the current scorer ignores positive/negative examples and the router labels the first three prompts as candidates without evidence.

- [ ] **Step 3: Implement the smallest local evidence helpers**

Create `src/core/route-signals.ts` with these exported functions:

```ts
export function normalizeRouteText(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/[\s，。！？、；：,.!?;:]+/g, "");
}

export function containsPhrase(query: string, phrase: string): boolean {
  const normalizedPhrase = normalizeRouteText(phrase);
  return Boolean(normalizedPhrase) && (query.includes(normalizedPhrase) || normalizedPhrase.includes(query));
}

export function sharedNgramScore(query: string, example: string): number {
  const normalizedExample = normalizeRouteText(example);
  if (!query || !normalizedExample) return 0;
  const grams = new Set<string>();
  for (let index = 0; index < normalizedExample.length - 1; index += 1) grams.add(normalizedExample.slice(index, index + 2));
  let hits = 0;
  for (let index = 0; index < query.length - 1; index += 1) if (grams.has(query.slice(index, index + 2))) hits += 1;
  return hits / Math.max(1, grams.size);
}
```

- [ ] **Step 4: Implement contrastive scoring**

Update `src/core/search.ts` so the score includes:

```ts
const GENERIC_WORDS = new Set(["问题", "方案", "产品", "设计", "决定", "行业", "数据", "专业"]);

const positiveExampleScore = Math.max(
  0,
  ...(prompt.positiveExamples ?? []).map((example) => containsPhrase(normalizedQuery, normalizeRouteText(example)) ? 120 : Math.round(sharedNgramScore(normalizedQuery, example) * 45)),
);
const negativeExamplePenalty = (prompt.negativeExamples ?? []).reduce(
  (total, example) => total + (containsPhrase(normalizedQuery, normalizeRouteText(example)) ? 100 : Math.round(sharedNgramScore(normalizedQuery, example) * 30)),
  0,
);
score += positiveExampleScore;
score -= negativeExamplePenalty;
```

Keep exact name matching at the top. Count generic keywords at no more than 8 points each, while non-generic keywords remain 25 points each and are capped. Retain description/useWhen/body search behavior for the Search mode. Remove the special-case concept explanation bonus; the `concept-explanation` metadata and positive/negative examples now provide that evidence. Keep `matchedIntent` as a compatibility helper only if existing tests or callers need it, but it must use the same metadata signals as `scorePrompt`.

- [ ] **Step 5: Make router confidence and no-evidence behavior explicit**

Keep the public `RouteResult` shape. In `localCandidates`, return ranked positive results when there are any; when there are none, return the first three prompts with score `0` and the same manual-choice reason. In `localResult`, never return `matched` for a zero-score result. Use `matched` only when `topScore >= 80` or when `topScore >= 45` and it leads the second candidate by at least 25 points. All other cases remain `needsManualChoice`.

- [ ] **Step 6: Run the focused tests and commit the matcher**

Run: `pnpm vitest run src/core/search.test.ts src/core/router.test.ts`

Expected: PASS, including the old exact-name/decision/concept tests and the new contrastive tests.

Commit: `git add src/core/route-signals.ts src/core/search.ts src/core/search.test.ts src/core/router.ts src/core/router.test.ts && git commit -m "feat: improve local prompt intent matching"`

### Task 3: Compile a copy-ready prompt with no blank placeholders

**Files:**
- Modify: `src/core/render-prompt.ts`
- Test: `src/core/render-prompt.test.ts`

- [ ] **Step 1: Write failing rendering tests**

Add these cases to `src/core/render-prompt.test.ts`:

```ts
it("fills the primary variable from a routed question", () => {
  const promptWithPrimaryVariable = { ...sample, primaryVariable: "问题" };

  expect(renderPrompt(promptWithPrimaryVariable, {}, "地球为什么是圆的")).toContain("请分析地球为什么是圆的");
});

it("marks every unfilled placeholder instead of leaving it blank", () => {
  const rendered = renderPrompt({ ...sample, primaryVariable: "问题" }, {}, "显示器怎么选");

  expect(rendered).toContain("目标是 （暂未提供）");
  expect(rendered).not.toContain("{{目标}}");
  expect(rendered).not.toContain("【问题】");
});
```

- [ ] **Step 2: Run the rendering tests and verify the primary-variable case fails**

Run: `pnpm vitest run src/core/render-prompt.test.ts`

Expected: FAIL because the current core renderer only appends the question and does not infer the declared primary variable or replace unresolved placeholders.

- [ ] **Step 3: Implement the shared renderer**

Update `renderPrompt` to:

1. Merge the explicit `variables` argument with `{ [prompt.primaryVariable]: question }` when `question` is non-empty.
2. Replace both `【变量】` and `{{变量}}` forms.
3. If the declared `primaryVariable` is not an exact placeholder label, replace the first `【...】` or `{{...}}` placeholder in the body. This supports existing copy such as `【填写概念或问题】` while keeping the metadata label short and editable.
4. Replace any remaining placeholder with `（暂未提供）`.
5. Append `用户原始问题：...` only when the question was not inserted into a placeholder.

Keep the current function signature so existing callers continue to compile. Update the old test that intentionally left `【未填写】` untouched to expect `（暂未提供）`; this is the deliberate new behavior. Use one renderer in the UI; do not keep a second copy of this logic in `src/renderer.ts`.

- [ ] **Step 4: Run all core tests and commit the renderer**

Run: `pnpm vitest run src/core`

Expected: PASS with the original rendering behavior, new primary-variable behavior, and no raw placeholders in generated output.

Commit: `git add src/core/render-prompt.ts src/core/render-prompt.test.ts && git commit -m "feat: compile routed questions into prompts"`

### Task 4: Add preview-before-copy interaction

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/renderer.ts`

- [ ] **Step 1: Add the preview container and styles**

Add `<section id="preview" class="preview hidden"></section>` between the results and editor sections in `index.html`.

Add styles for `.preview`, `.preview-text`, `.preview-actions`, and `.preview.hidden` in `styles.css`. The preview must use a scrollable `<pre>` area, preserve Chinese line breaks, and fit within the existing 560px minimum window width.

- [ ] **Step 2: Replace the renderer-local prompt compiler**

Import `renderPrompt` from `./core/render-prompt` in `src/renderer.ts`, remove the local `renderPrompt` function, and add:

```ts
const previewElement = document.querySelector<HTMLElement>("#preview")!;
let previewText = "";

function hidePreview(): void {
  previewText = "";
  previewElement.classList.add("hidden");
  previewElement.innerHTML = "";
}

function showPreview(prompt: Prompt, question: string): void {
  previewText = renderPrompt(prompt, {}, question);
  previewElement.classList.remove("hidden");
  previewElement.innerHTML = `
    <div class="editor-title-row"><h2>完整提示词预览</h2><span class="editor-id">复制前请确认</span></div>
    <pre class="preview-text">${escapeHtml(previewText)}</pre>
    <div class="preview-actions">
      <button id="cancel-preview" class="secondary-button">返回</button>
      <button id="copy-preview" class="primary-button">复制完整提示词</button>
    </div>`;
  document.querySelector<HTMLButtonElement>("#cancel-preview")!.addEventListener("click", hidePreview);
  document.querySelector<HTMLButtonElement>("#copy-preview")!.addEventListener("click", () => void copyPreview());
}
```

Implement `copyPreview` by calling `window.promptRouter.usePrompt(previewText)`, preserving the existing status and automatic-paste fallback, then hiding the preview only after the IPC call returns.

- [ ] **Step 3: Route every use action through preview**

Change `useCandidate` so it calls `showPreview(promptFromEditor() ?? selected, mode === "route" ? mainInput.value : "")` instead of copying immediately. Search mode therefore previews the raw template; route mode previews the question-filled template. Change the route button label to `生成并复制` and keep the edit button unchanged.

Call `hidePreview()` when switching modes, refreshing results, or opening the editor so stale text cannot be copied for a newly selected candidate.

- [ ] **Step 4: Build and manually smoke-test the UI path**

Run: `pnpm build`

Expected: PASS with no TypeScript errors.

Manual check: start the app, enter `地球为什么是圆的`, switch to“自动匹配”, select“双层解释法”, click“生成并复制”, confirm the preview contains the question in the first field and no raw `【...】`/`{{...}}` placeholder, then click“复制完整提示词”.

Commit: `git add index.html styles.css src/renderer.ts && git commit -m "feat: preview complete prompts before copying"`

### Task 5: Make routing metadata editable and add the 100-question regression suite

**Files:**
- Modify: `src/renderer.ts`
- Create: `src/core/router-coverage.test.ts`

- [ ] **Step 1: Add routing fields to the editor**

Add editor fields for `intent`, `primaryVariable`, `positiveExamples`, and `negativeExamples`. Use the existing comma-separated input convention for the two example lists. In `promptFromEditor`, parse each field into the corresponding `Prompt` property and preserve `undefined` for empty optional values. Saving a prompt must round-trip these fields through `PromptStore`.

- [ ] **Step 2: Create the fixed 100-question fixture**

Create `src/core/router-coverage.test.ts`. Load the actual Markdown files from `prompts/` using `readFileSync` and `parsePromptMarkdown`, then define 100 cases:

- 8 clear natural-language questions for each of the 12 bundled prompts (96 cases), each with one expected prompt id;
- `今天晚上吃什么`, `帮我写一句祝福`, `现在几点`, and `你好` as four ambiguous cases that must remain manual.

The test must run the real `routeQuestion` function. It must record every mismatch and fail with the question, expected id, actual top candidate id, status, and score. The assertions are:

```ts
expect(clearCases.filter((item) => item.actual === item.expected).length).toBeGreaterThanOrEqual(90);
expect(ambiguousResults.every((result) => result.status === "needsManualChoice")).toBe(true);
```

Also add a rendering assertion for one routed case:

```ts
const rendered = renderPrompt(promptsById.get("two-layer-explanation")!, {}, "地球为什么是圆的");
expect(rendered).toContain("地球为什么是圆的");
expect(rendered).not.toMatch(/【[^】]+】|{{[^}]+}}/);
```

- [ ] **Step 3: Run the 100-question test before tuning further**

Run: `pnpm vitest run src/core/router-coverage.test.ts`

Expected before final tuning: the suite may fail the 90/96 threshold, but it must print all mismatches and prove the test is exercising the real 12-file library rather than fixtures embedded in the test.

- [ ] **Step 4: Tune only against failure categories**

Use the failure report to adjust metadata examples, generic-word weights, negative evidence, and confidence thresholds. Do not add one-off query strings to the production code. Every tuning change must be followed by:

```bash
pnpm vitest run src/core/search.test.ts src/core/router.test.ts src/core/router-coverage.test.ts
```

Expected: all focused tests pass and the coverage suite reaches at least 90/96 clear cases with all four ambiguous cases abstaining.

- [ ] **Step 5: Commit editor and regression coverage**

Run: `pnpm test`

Expected: PASS for the complete Vitest suite.

Commit: `git add src/renderer.ts src/core/router-coverage.test.ts && git commit -m "test: add 100-question prompt routing coverage"`

### Task 6: Document and verify the release candidate

**Files:**
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Update user-facing documentation**

Document that:

- the current matcher is local and free with no API Key;
- matching uses intent metadata, examples, negative evidence, and abstention;
- “生成并复制” previews a filled prompt and marks missing fields as `（暂未提供）`;
- the app does not call any AI service in this version;
- users can edit routing metadata in Markdown or in the editor.

- [ ] **Step 2: Increment the version**

Change `package.json` from `0.1.4` to `0.1.5` after code and tests are green. Do not create a release tag before the verification step.

- [ ] **Step 3: Run the final verification commands**

Run:

```bash
pnpm test
pnpm build
git diff --check
git status --short
```

Expected:

- all Vitest tests pass, including the 100-question suite;
- TypeScript compilation succeeds;
- `git diff --check` prints no errors;
- only intended source, prompt, documentation, and test files are changed.

- [ ] **Step 4: Commit the release candidate**

Commit: `git add README.md package.json && git commit -m "release: prepare v0.1.5 local router"`

import type { Prompt, PromptRouterApi, PromptSearchResult, RouteCandidate, RouteResult } from "./core/types";
import { renderPrompt } from "./core/render-prompt.js";

declare global {
  interface Window {
    promptRouter: PromptRouterApi;
  }
}

type Mode = "search" | "route";

const mainInput = document.querySelector<HTMLTextAreaElement>("#main-input")!;
const inputLabel = document.querySelector<HTMLLabelElement>("#input-label")!;
const runButton = document.querySelector<HTMLButtonElement>("#run-button")!;
const routeShortcut = document.querySelector<HTMLButtonElement>("#route-shortcut")!;
const resultsElement = document.querySelector<HTMLElement>("#results")!;
const previewElement = document.querySelector<HTMLElement>("#preview")!;
const editorElement = document.querySelector<HTMLElement>("#editor")!;
const statusElement = document.querySelector<HTMLElement>("#status")!;
const promptCountElement = document.querySelector<HTMLElement>("#prompt-count")!;
const settingsButton = document.querySelector<HTMLButtonElement>("#settings-button")!;
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".mode-button"));

let mode: Mode = "search";
let prompts: Prompt[] = [];
let searchResults: PromptSearchResult[] = [];
let routeResult: RouteResult | null = null;
let selectedIndex = 0;
let editingPrompt: Prompt | null = null;
let previewText = "";
let previewTemplateText = "";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] ?? character));
}

function setStatus(message: string, error = false): void {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", error);
}

function hidePreview(): void {
  previewText = "";
  previewTemplateText = "";
  previewElement.classList.add("hidden");
  previewElement.innerHTML = "";
}

function updateModeUi(): void {
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  const routeMode = mode === "route";
  inputLabel.textContent = routeMode ? "描述你现在遇到的问题" : "搜索名称、分类、关键词";
  mainInput.placeholder = routeMode ? "例如：我在两个选项之间犹豫，不知道该选哪个" : "例如：双向钢人论证、事实核查";
  runButton.textContent = routeMode ? "开始匹配" : "搜索";
  routeShortcut.classList.toggle("hidden", routeMode);
  selectedIndex = 0;
  routeResult = null;
  hidePreview();
  editorElement.classList.add("hidden");
  if (!routeMode) void refreshSearch();
  else renderResults();
}

function renderSearchResults(): void {
  if (!searchResults.length) {
    resultsElement.innerHTML = `<div class="empty-state">没有找到提示词。可以换一个关键词，或直接编辑提示词库。</div>`;
    return;
  }
  resultsElement.innerHTML = searchResults.map(({ prompt, score }, index) => `
    <article class="result-card ${index === selectedIndex ? "selected" : ""}" data-index="${index}">
      <div>
        <div class="meta">${escapeHtml(prompt.category)}${score ? ` · 匹配 ${score}` : ""}</div>
        <h3>${escapeHtml(prompt.name)}</h3>
        <p><span class="usage-label">适用：</span>${escapeHtml(prompt.useWhen || prompt.description || prompt.body.slice(0, 120))}</p>
      </div>
      <div class="card-actions">
        <button class="secondary-button" data-action="edit" data-index="${index}">编辑</button>
        <button class="primary-button" data-action="use" data-index="${index}">使用</button>
      </div>
    </article>
  `).join("");
}

function renderRouteResults(): void {
  const candidates = routeResult?.candidates ?? [];
  if (!candidates.length) {
    if (routeResult?.status === "unavailable") {
      resultsElement.innerHTML = `<div class="empty-state">提示词库为空，请先添加 Markdown 提示词。</div>`;
    } else if (routeResult?.status === "needsManualChoice") {
      resultsElement.innerHTML = `<div class="empty-state">暂时无法判断适合哪条提示词。请补充问题背景，或切换到“搜索提示词”手动选择。</div>`;
    } else {
      resultsElement.innerHTML = `<div class="empty-state">输入问题后点击“开始匹配”。</div>`;
    }
    return;
  }
  const banner = routeResult?.providerUsed ? "AI 已参与判断，仍请你确认候选" : routeResult?.status === "needsManualChoice" ? "本地规则不够确定，请手动确认" : "本地规则已找到高置信度候选";
  resultsElement.innerHTML = `<div class="route-banner">${escapeHtml(banner)}</div>` + candidates.map((candidate, index) => `
    <article class="result-card ${index === selectedIndex ? "selected" : ""}" data-index="${index}">
      <div>
        <div class="meta">${escapeHtml(candidate.prompt.category)} · 评分 ${candidate.score}</div>
        <h3>${escapeHtml(candidate.prompt.name)}</h3>
        <p>${escapeHtml(candidate.reason)}。<span class="usage-label">适用：</span>${escapeHtml(candidate.prompt.useWhen || candidate.prompt.description)}</p>
      </div>
      <div class="card-actions">
        <button class="secondary-button" data-action="edit" data-index="${index}">编辑</button>
        <button class="primary-button" data-action="use" data-index="${index}">生成并复制</button>
      </div>
    </article>
  `).join("");
}

function renderResults(): void {
  if (mode === "search") renderSearchResults();
  else renderRouteResults();
}

function renderEditor(prompt: Prompt): void {
  hidePreview();
  editingPrompt = prompt;
  editorElement.classList.remove("hidden");
  editorElement.innerHTML = `
    <div class="editor-title-row"><h2>编辑提示词</h2><span class="editor-id">${escapeHtml(prompt.fileName)}</span></div>
    <div class="editor-grid">
      <div class="field"><label for="edit-name">名称</label><input id="edit-name" value="${escapeHtml(prompt.name)}" /></div>
      <div class="field"><label for="edit-category">分类</label><input id="edit-category" value="${escapeHtml(prompt.category)}" /></div>
      <div class="field full"><label for="edit-description">用途说明</label><input id="edit-description" value="${escapeHtml(prompt.description)}" /></div>
      <div class="field full"><label for="edit-keywords">关键词（用逗号分隔）</label><input id="edit-keywords" value="${escapeHtml(prompt.keywords.join(", "))}" /></div>
      <div class="field full"><label for="edit-variables">变量（用逗号分隔）</label><input id="edit-variables" value="${escapeHtml(prompt.variables.join(", "))}" /></div>
      <div class="field"><label for="edit-intent">路由意图</label><input id="edit-intent" value="${escapeHtml(prompt.intent ?? "")}" /></div>
      <div class="field"><label for="edit-primary-variable">主要填充字段</label><input id="edit-primary-variable" value="${escapeHtml(prompt.primaryVariable ?? "")}" /></div>
      <div class="field full"><label for="edit-positive-examples">适用示例（用逗号分隔）</label><textarea id="edit-positive-examples" rows="3">${escapeHtml((prompt.positiveExamples ?? []).join(", "))}</textarea></div>
      <div class="field full"><label for="edit-negative-examples">不适用示例（用逗号分隔）</label><textarea id="edit-negative-examples" rows="3">${escapeHtml((prompt.negativeExamples ?? []).join(", "))}</textarea></div>
      <div class="field full"><label for="edit-body">提示词正文</label><textarea id="edit-body" rows="11">${escapeHtml(prompt.body)}</textarea></div>
    </div>
    <div class="editor-actions"><button id="cancel-edit" class="secondary-button">取消</button><button id="save-edit" class="primary-button">保存修改</button></div>
  `;
  document.querySelector<HTMLButtonElement>("#cancel-edit")!.addEventListener("click", () => editorElement.classList.add("hidden"));
  document.querySelector<HTMLButtonElement>("#save-edit")!.addEventListener("click", () => void saveEditor());
}

function valueOf(id: string): string {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value.trim() ?? "";
}

function promptFromEditor(): Prompt | null {
  if (!editingPrompt) return null;
  return {
    ...editingPrompt,
    name: valueOf("edit-name") || editingPrompt.name,
    category: valueOf("edit-category") || "未分类",
    description: valueOf("edit-description"),
    keywords: valueOf("edit-keywords").split(",").map((item) => item.trim()).filter(Boolean),
    variables: valueOf("edit-variables").split(",").map((item) => item.trim()).filter(Boolean),
    intent: valueOf("edit-intent") || undefined,
    primaryVariable: valueOf("edit-primary-variable") || undefined,
    positiveExamples: valueOf("edit-positive-examples").split(",").map((item) => item.trim()).filter(Boolean),
    negativeExamples: valueOf("edit-negative-examples").split(",").map((item) => item.trim()).filter(Boolean),
    body: valueOf("edit-body"),
  };
}

async function saveEditor(): Promise<void> {
  const next = promptFromEditor();
  if (!next) return;
  try {
    editingPrompt = await window.promptRouter.savePrompt(next);
    setStatus("已保存，提示词文件也已更新");
    editorElement.classList.add("hidden");
    await refreshPrompts();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "保存失败", true);
  }
}

function currentCandidate(index: number): Prompt | undefined {
  return mode === "search" ? searchResults[index]?.prompt : routeResult?.candidates[index]?.prompt;
}

async function copyText(text: string): Promise<void> {
  if (!text) return;
  try {
    const result = await window.promptRouter.usePrompt(text);
    setStatus(result.message, !result.pasted && !result.clipboardReady);
    hidePreview();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "使用提示词失败", true);
  }
}

function showPreview(prompt: Prompt, question: string): void {
  previewText = renderPrompt(prompt, {}, question);
  previewTemplateText = prompt.body.trim();
  previewElement.classList.remove("hidden");
  previewElement.innerHTML = `
    <div class="editor-title-row"><h2>完整提示词预览</h2><span class="editor-id">复制前请确认</span></div>
    <pre class="preview-text">${escapeHtml(previewText)}</pre>
    <div class="preview-actions">
      <button id="cancel-preview" class="secondary-button">返回</button>
      <button id="copy-template" class="secondary-button">复制原始模板</button>
      <button id="copy-preview" class="primary-button">复制完整提示词</button>
    </div>`;
  document.querySelector<HTMLButtonElement>("#cancel-preview")!.addEventListener("click", hidePreview);
  document.querySelector<HTMLButtonElement>("#copy-template")!.addEventListener("click", () => void copyText(previewTemplateText));
  document.querySelector<HTMLButtonElement>("#copy-preview")!.addEventListener("click", () => void copyText(previewText));
  previewElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function useCandidate(index: number): Promise<void> {
  const selected = currentCandidate(index);
  if (!selected) return;
  const prompt = promptFromEditor() ?? selected;
  const question = mode === "route" ? mainInput.value : "";
  showPreview(prompt, question);
}

async function refreshPrompts(): Promise<void> {
  prompts = await window.promptRouter.listPrompts();
  promptCountElement.textContent = `${prompts.length} 个提示词`;
  await refreshSearch();
}

async function refreshSearch(): Promise<void> {
  if (mode !== "search") return;
  hidePreview();
  searchResults = await window.promptRouter.searchPrompts(mainInput.value);
  selectedIndex = Math.min(selectedIndex, Math.max(0, searchResults.length - 1));
  renderResults();
}

async function runRoute(): Promise<void> {
  const question = mainInput.value.trim();
  if (!question) {
    setStatus("先输入你正在处理的问题", true);
    return;
  }
  runButton.disabled = true;
  hidePreview();
  setStatus("正在判断适合的提示词…");
  try {
    routeResult = await window.promptRouter.routeQuestion(question);
    selectedIndex = 0;
    renderResults();
    setStatus("");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "自动匹配失败", true);
  } finally {
    runButton.disabled = false;
  }
}

modeButtons.forEach((button) => button.addEventListener("click", () => {
  mode = button.dataset.mode as Mode;
  updateModeUi();
  if (mode === "route" && mainInput.value.trim()) void runRoute();
}));

mainInput.addEventListener("input", () => {
  if (mode === "search") void refreshSearch();
});

runButton.addEventListener("click", () => {
  if (mode === "search") void refreshSearch();
  else void runRoute();
});

routeShortcut.addEventListener("click", () => {
  mode = "route";
  updateModeUi();
  if (mainInput.value.trim()) void runRoute();
  else {
    mainInput.focus();
    setStatus("把你的问题写进来，我会帮你挑提示词");
  }
});

mainInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const total = mode === "search" ? searchResults.length : routeResult?.candidates.length ?? 0;
    if (!total) return;
    event.preventDefault();
    selectedIndex = (selectedIndex + (event.key === "ArrowDown" ? 1 : -1) + total) % total;
    renderResults();
  }
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    if (mode === "route" && !routeResult) void runRoute();
    else void useCandidate(selectedIndex);
  }
});

resultsElement.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;
  const index = Number(button.dataset.index);
  selectedIndex = index;
  const prompt = currentCandidate(index);
  if (!prompt) return;
  if (button.dataset.action === "edit") renderEditor(prompt);
  else void useCandidate(index);
});

settingsButton.addEventListener("click", async () => {
  const next = await window.promptRouter.choosePromptDirectory();
  if (next) {
    setStatus(`已切换提示词目录，共 ${next.promptDirectory}`);
    await refreshPrompts();
  }
});

window.promptRouter.onPanelOpened(() => {
  mainInput.focus();
  mainInput.select();
});

window.promptRouter.onPromptsChanged(() => {
  void refreshPrompts().then(() => setStatus("提示词文件已从外部更新"));
});

updateModeUi();
void refreshPrompts().catch((error) => setStatus(error instanceof Error ? error.message : "提示词库加载失败", true));

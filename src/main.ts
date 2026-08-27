import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain } from "electron";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PromptStore } from "./core/prompt-store";
import { searchPrompts } from "./core/search";
import { routeQuestion } from "./core/router";
import { applyRoutingDefaults } from "./core/routing-defaults";
import { shouldReopenPanel } from "./core/use-feedback";
import type { AppSettings, PasteResult, Prompt } from "./core/types";

const execFileAsync = promisify(execFile);
const DEFAULT_HOTKEY = "CommandOrControl+Shift+Space";

let panel: BrowserWindow | null = null;
let store: PromptStore | null = null;
let settings: AppSettings | null = null;
let stopStoreWatch: (() => void) | null = null;
let bundledPromptsById = new Map<string, Prompt>();

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

async function readSettings(): Promise<AppSettings> {
  if (settings) return settings;
  try {
    const saved = JSON.parse(await readFile(settingsPath(), "utf8")) as Partial<AppSettings>;
    settings = {
      promptDirectory: saved.promptDirectory || join(app.getPath("userData"), "prompts"),
      hotkey: saved.hotkey || DEFAULT_HOTKEY,
      aiConfigured: Boolean(saved.aiConfigured),
    };
  } catch {
    settings = {
      promptDirectory: join(app.getPath("userData"), "prompts"),
      hotkey: DEFAULT_HOTKEY,
      aiConfigured: false,
    };
  }
  return settings;
}

async function writeSettings(next: AppSettings): Promise<void> {
  settings = next;
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(next, null, 2), "utf8");
}

async function seedPromptDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const existing = await readdir(directory).catch(() => []);
  if (existing.some((file) => file.toLowerCase().endsWith(".md"))) return;

  const bundledDirectory = join(app.getAppPath(), "prompts");
  const bundled = await readdir(bundledDirectory).catch(() => []);
  for (const file of bundled.filter((item) => item.toLowerCase().endsWith(".md"))) {
    await copyFile(join(bundledDirectory, file), join(directory, file));
  }
}

async function loadPrompts(): Promise<Prompt[]> {
  const prompts = await store?.loadAll() ?? [];
  return prompts.map((prompt) => applyRoutingDefaults(prompt, bundledPromptsById.get(prompt.id)));
}

function createPanel(): BrowserWindow {
  const nextPanel = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 560,
    minHeight: 520,
    show: false,
    frame: false,
    backgroundColor: "#0f1117",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.js"),
    },
  });
  nextPanel.loadFile(join(app.getAppPath(), "index.html"));
  nextPanel.once("ready-to-show", () => nextPanel.show());
  nextPanel.on("closed", () => { panel = null; });
  return nextPanel;
}

function togglePanel(): void {
  if (!panel) return;
  if (panel.isVisible()) {
    panel.hide();
    return;
  }
  panel.show();
  panel.focus();
  panel.webContents.send("panel-opened");
}

async function pasteIntoPreviousApp(): Promise<PasteResult> {
  if (process.platform === "darwin") {
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      await execFileAsync("/usr/bin/osascript", ["-e", 'tell application "System Events" to keystroke "v" using {command down}']);
      return { clipboardReady: true, pasted: true, message: "已插入当前输入框" };
    } catch {
      return { clipboardReady: true, pasted: false, message: "已复制到剪贴板，但 macOS 未允许自动粘贴" };
    }
  }

  if (process.platform === "win32") {
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys('^v')"]);
      return { clipboardReady: true, pasted: true, message: "已插入当前输入框" };
    } catch {
      return { clipboardReady: true, pasted: false, message: "已复制到剪贴板，但 Windows 未完成自动粘贴" };
    }
  }

  return { clipboardReady: true, pasted: false, message: "已复制到剪贴板，请手动粘贴" };
}

function registerIpc(): void {
  ipcMain.handle("list-prompts", async () => loadPrompts());
  ipcMain.handle("search-prompts", async (_event, query: string) => searchPrompts(await loadPrompts(), query));
  ipcMain.handle("route-question", async (_event, question: string) => routeQuestion(question, await loadPrompts()));
  ipcMain.handle("save-prompt", async (_event, prompt: Prompt) => {
    if (!store) throw new Error("提示词库尚未准备好");
    return store.save(prompt);
  });
  ipcMain.handle("use-prompt", async (_event, text: string) => {
    clipboard.writeText(text);
    panel?.hide();
    const result = await pasteIntoPreviousApp();
    if (shouldReopenPanel(result)) {
      panel?.show();
      panel?.focus();
    }
    return result;
  });
  ipcMain.handle("get-settings", async () => readSettings());
  ipcMain.handle("choose-prompt-directory", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    const selected = result.filePaths[0];
    if (!selected) return null;
    await writeSettings({ ...(await readSettings()), promptDirectory: selected });
    stopStoreWatch?.();
    store = new PromptStore(selected);
    stopStoreWatch = store.watch(() => panel?.webContents.send("prompts-changed"));
    return settings;
  });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  const bundledPrompts = await new PromptStore(join(app.getAppPath(), "prompts")).loadAll();
  bundledPromptsById = new Map(bundledPrompts.map((prompt) => [prompt.id, prompt]));
  const currentSettings = await readSettings();
  await seedPromptDirectory(currentSettings.promptDirectory);
  store = new PromptStore(currentSettings.promptDirectory);
  stopStoreWatch = store.watch(() => panel?.webContents.send("prompts-changed"));
  registerIpc();
  panel = createPanel();
  globalShortcut.register(currentSettings.hotkey, togglePanel);
  app.on("activate", () => { if (!panel) panel = createPanel(); else togglePanel(); });
  app.on("will-quit", () => {
    stopStoreWatch?.();
    globalShortcut.unregisterAll();
  });
}

void bootstrap();

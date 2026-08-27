import { contextBridge, ipcRenderer } from "electron";
import type { PromptRouterApi } from "./core/types";

const api: PromptRouterApi = {
  listPrompts: () => ipcRenderer.invoke("list-prompts"),
  searchPrompts: (query) => ipcRenderer.invoke("search-prompts", query),
  routeQuestion: (question) => ipcRenderer.invoke("route-question", question),
  savePrompt: (prompt) => ipcRenderer.invoke("save-prompt", prompt),
  usePrompt: (text) => ipcRenderer.invoke("use-prompt", text),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  choosePromptDirectory: () => ipcRenderer.invoke("choose-prompt-directory"),
  onPanelOpened: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("panel-opened", listener);
    return () => ipcRenderer.removeListener("panel-opened", listener);
  },
  onPromptsChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("prompts-changed", listener);
    return () => ipcRenderer.removeListener("prompts-changed", listener);
  },
};

contextBridge.exposeInMainWorld("promptRouter", api);

export type Prompt = {
  id: string;
  fileName: string;
  name: string;
  description: string;
  useWhen: string;
  category: string;
  keywords: string[];
  variables: string[];
  intent?: string;
  positiveExamples?: string[];
  negativeExamples?: string[];
  primaryVariable?: string;
  body: string;
  rawFrontmatter: string[];
};

export type PromptSearchResult = {
  prompt: Prompt;
  score: number;
};

export type RouteCandidate = {
  prompt: Prompt;
  score: number;
  reason: string;
};

export type RouteResult = {
  status: "matched" | "needsManualChoice" | "unavailable";
  candidates: RouteCandidate[];
  providerUsed: boolean;
};

export interface RouteProvider {
  classify(question: string, prompts: Prompt[]): Promise<string[]>;
}

export type PromptVariables = Record<string, string>;

export type PasteResult = {
  clipboardReady: boolean;
  pasted: boolean;
  message: string;
};

export type AppSettings = {
  promptDirectory: string;
  hotkey: string;
  aiConfigured: boolean;
};

export type PromptRouterApi = {
  listPrompts: () => Promise<Prompt[]>;
  searchPrompts: (query: string) => Promise<PromptSearchResult[]>;
  routeQuestion: (question: string) => Promise<RouteResult>;
  savePrompt: (prompt: Prompt) => Promise<Prompt>;
  usePrompt: (text: string) => Promise<PasteResult>;
  getSettings: () => Promise<AppSettings>;
  choosePromptDirectory: () => Promise<AppSettings | null>;
  onPanelOpened: (callback: () => void) => () => void;
  onPromptsChanged: (callback: () => void) => () => void;
};

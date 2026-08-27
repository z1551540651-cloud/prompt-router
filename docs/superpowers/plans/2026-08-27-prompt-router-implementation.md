# Prompt Router Implementation Plan

> **For agentic workers:** Implement this plan task-by-task in the current project. Keep the changes small and run the named verification command after each task.

**Goal:** Build a local-first Electron desktop app for macOS and Windows that stores editable Markdown prompts, opens with a global hotkey, supports search/insertion, and routes ordinary questions to the best prompt through local rules with an optional AI fallback.

**Architecture:** Keep platform-independent prompt parsing, search, rendering, and routing in `src/core`. Keep Electron window, IPC, clipboard, global shortcut, and paste behavior in `src/main.ts` and `src/preload.ts`. Keep the first UI in a single small renderer without a UI framework so the prototype remains easy to run and modify.

**Tech Stack:** Node.js, pnpm, Electron, TypeScript, Vitest, native HTML/CSS, Markdown prompt files with a small frontmatter parser.

---

## File map

- Create `package.json`: scripts, Electron runtime, Vitest and TypeScript dependencies.
- Create `tsconfig.json`: compile main, preload, renderer, and core modules to `dist`.
- Create `index.html`: renderer entry document.
- Create `styles.css`: quick-panel and editor styles.
- Create `src/core/types.ts`: shared prompt, route, settings, and IPC types.
- Create `src/core/frontmatter.ts`: parse and serialize the supported Markdown frontmatter while preserving unknown lines.
- Create `src/core/prompt-store.ts`: scan, read, save, back up, and reload prompt files.
- Create `src/core/search.ts`: deterministic local search and ranking.
- Create `src/core/render-prompt.ts`: replace variables and render a final prompt plus user question.
- Create `src/core/router.ts`: rule-based candidate scoring and optional provider interface.
- Create `src/core/*.test.ts`: focused unit tests for each pure core module.
- Create `src/main.ts`: Electron lifecycle, window, hotkey, IPC, settings, clipboard, and seed directory.
- Create `src/preload.ts`: narrow context-bridge API for the renderer.
- Create `src/renderer.ts`: quick panel state, search mode, route mode, editor, and event handlers.
- Create `prompts/*.md`: the 12 prompt templates supplied by the user, seeded as editable files.
- Create `README.md`: install, run, permissions, prompt format, sync-folder setup, and Windows build instructions.

## Task 1: Scaffold the Electron TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `styles.css`
- Create: `.gitignore`

- [ ] **Step 1: Add the package manifest and scripts.**

Use these scripts so all later verification commands are stable:

```json
{
  "name": "prompt-router",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "pnpm build && electron .",
    "dev": "pnpm build && electron .",
    "dist:mac": "pnpm build && electron-builder --mac",
    "dist:win": "pnpm build && electron-builder --win"
  },
  "build": {
    "appId": "local.prompt-router",
    "productName": "Prompt Router",
    "files": ["dist/**/*", "index.html", "styles.css", "prompts/**/*", "README.md"],
    "mac": { "category": "public.app-category.productivity" },
    "win": { "target": "nsis" }
  },
  "devDependencies": {
    "@types/node": "latest",
    "electron": "latest",
    "electron-builder": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Add TypeScript compiler settings.**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM"],
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Add a minimal document and ignore generated files.**

`index.html` loads `dist/renderer.js` and `styles.css`; `.gitignore` excludes `node_modules`, `dist`, release artifacts, and local Electron data.

- [ ] **Step 4: Install dependencies and compile.**

Run `pnpm install && pnpm build`. Expected: TypeScript exits with code 0 and creates `dist/`.

- [ ] **Step 5: Commit the scaffold.**

Run `git add package.json pnpm-lock.yaml tsconfig.json index.html styles.css .gitignore && git commit -m "build: scaffold prompt router desktop app"`.

## Task 2: Implement Markdown prompt parsing and serialization

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/frontmatter.ts`
- Test: `src/core/frontmatter.test.ts`

- [ ] **Step 1: Write parser tests first.**

Cover a prompt with all supported fields, a prompt with no frontmatter, an inline list with Chinese text, and preservation of an unknown frontmatter field. The expected parsed shape is:

```ts
type Prompt = {
  id: string;
  fileName: string;
  name: string;
  description: string;
  category: string;
  keywords: string[];
  variables: string[];
  body: string;
  rawFrontmatter: string[];
};
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run `pnpm vitest run src/core/frontmatter.test.ts`. Expected: FAIL because `parsePromptMarkdown` does not exist.

- [ ] **Step 3: Implement `parsePromptMarkdown` and `serializePromptMarkdown`.**

Recognize only a frontmatter block beginning with `---` and ending at the next standalone `---`. Parse scalar values after the first colon, parse bracketed comma-separated lists, derive a missing `id` from the filename, and preserve all raw frontmatter lines. Serialization replaces or appends only `id`, `name`, `description`, `category`, `keywords`, and `variables`, then writes the unchanged body.

- [ ] **Step 4: Run the focused test and verify it passes.**

Run `pnpm vitest run src/core/frontmatter.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit the parser.**

Run `git add src/core/types.ts src/core/frontmatter.ts src/core/frontmatter.test.ts && git commit -m "feat: parse editable markdown prompts"`.

## Task 3: Add the prompt store, search, rendering, and tests

**Files:**
- Create: `src/core/prompt-store.ts`
- Create: `src/core/search.ts`
- Create: `src/core/render-prompt.ts`
- Test: `src/core/prompt-store.test.ts`
- Test: `src/core/search.test.ts`
- Test: `src/core/render-prompt.test.ts`

- [ ] **Step 1: Write failing tests for file-backed behavior.**

Use Vitest temporary directories. Test that the store reads only `.md`, creates a `.bak` before overwriting an existing file, reloads changed files, and reports malformed files without deleting them. Test ranking with exact name first, keyword/category next, and body match last. Test variable replacement and appending the user's question under the prompt body.

- [ ] **Step 2: Run the focused tests and verify failure.**

Run `pnpm vitest run src/core/prompt-store.test.ts src/core/search.test.ts src/core/render-prompt.test.ts`. Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the store.**

Expose `loadAll()`, `save(prompt)`, `readErrors()`, and `watch(onChange)`. Use `fs.promises`, atomic writes through a temporary sibling file followed by rename, and a single backup at `<file>.bak` before replacing an existing prompt. Ignore temporary and backup files during scans.

- [ ] **Step 4: Implement search and rendering.**

`searchPrompts(prompts, query)` returns all prompts for an empty query. For non-empty input, score name exact match 100, name substring 60, category/keyword 40, description 25, and body 10; sort by score then name. `renderPrompt(prompt, variables, question)` replaces `【变量】` and `{{变量}}`, leaves unknown placeholders unchanged, and adds `\n\n用户问题：${question}` when a question is supplied.

- [ ] **Step 5: Run focused tests and verify they pass.**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 6: Commit the core store utilities.**

Run `git add src/core/prompt-store.ts src/core/search.ts src/core/render-prompt.ts src/core/*.test.ts && git commit -m "feat: store search and render prompt files"`.

## Task 4: Implement the hybrid prompt router

**Files:**
- Create: `src/core/router.ts`
- Test: `src/core/router.test.ts`

- [ ] **Step 1: Write failing routing tests.**

Test that a question containing “两个选择、犹豫、决定” selects the steelman prompt, that an exact keyword match outranks a generic body match, that scores below the confidence threshold return `needsManualChoice`, and that a provider failure falls back to local candidates.

- [ ] **Step 2: Run the routing test and verify failure.**

Run `pnpm vitest run src/core/router.test.ts`. Expected: FAIL because the router does not exist.

- [ ] **Step 3: Implement local scoring and provider fallback.**

Define:

```ts
type RouteResult = {
  status: "matched" | "needsManualChoice" | "unavailable";
  candidates: Array<{ prompt: Prompt; score: number; reason: string }>;
  providerUsed: boolean;
};

interface RouteProvider {
  classify(question: string, prompts: Prompt[]): Promise<string[]>;
}
```

Use the search scorer plus Chinese trigger phrases from each prompt's keywords. Treat a top score of 60 or a top-two gap of 20 as a confident local match. If not confident and a provider is configured, ask it for prompt IDs only; accept only IDs that exist in the local store. Any provider error returns local candidates with `providerUsed: false`.

- [ ] **Step 4: Run the routing test and verify it passes.**

Run `pnpm vitest run src/core/router.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit the router.**

Run `git add src/core/router.ts src/core/router.test.ts && git commit -m "feat: add hybrid prompt routing"`.

## Task 5: Add Electron lifecycle, IPC, settings, and paste fallback

**Files:**
- Create: `src/main.ts`
- Create: `src/preload.ts`
- Modify: `src/core/types.ts`

- [ ] **Step 1: Define the narrow renderer API.**

Expose only `listPrompts`, `searchPrompts`, `routeQuestion`, `savePrompt`, `usePrompt`, `getSettings`, and `choosePromptDirectory` through `contextBridge`. Keep filesystem paths, provider keys, and Electron objects out of the renderer.

- [ ] **Step 2: Implement app startup and seed directory.**

On `app.whenReady`, use `<userData>/prompts` as the default directory and copy bundled `prompts/*.md` there only when the target directory has no Markdown files. Create one hidden frameless panel window. Register `CommandOrControl+Shift+Space`; toggle visibility and focus the search field through a renderer message.

- [ ] **Step 3: Implement IPC handlers.**

Create one `PromptStore` instance in the main process. IPC handlers load and search prompts, save prompt text, route a question, open a directory chooser, and persist settings in `<userData>/settings.json` without storing API keys there.

- [ ] **Step 4: Implement clipboard and best-effort paste.**

`usePrompt` writes final text to `clipboard.writeText`, hides the panel, then:

- macOS: call `osascript` to send Command+V; return a permission error if the command fails;
- Windows: call `powershell.exe` with `WScript.Shell.SendKeys('^v')`; return a failure if the command fails;
- other systems: return clipboard-only status.

Never pass prompt text into the shell command. If automation fails, the IPC result must say `clipboardReady: true` and `pasted: false`.

- [ ] **Step 5: Run a compile check.**

Run `pnpm build`. Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit the Electron shell.**

Run `git add src/main.ts src/preload.ts src/core/types.ts && git commit -m "feat: add desktop shell and paste fallback"`.

## Task 6: Build the quick panel and editor UI

**Files:**
- Create: `src/renderer.ts`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: Add the two-mode layout.**

The panel contains a segmented switch for “搜索提示词” and “自动匹配”, one main input, a result list, a preview/editor region, and a footer showing hotkey and paste status. The editor uses a plain textarea and variable inputs generated from the selected prompt.

- [ ] **Step 2: Implement search mode.**

On each input event, call the preload API, render result cards with name/category/description, support arrow-key selection and Enter to use, and provide an Edit action that loads the prompt into the editor.

- [ ] **Step 3: Implement route mode.**

Submit the question to `routeQuestion`, show up to three candidates with their reasons and whether AI fallback was used, require a click or Enter to confirm, then render and use the selected prompt. When the result is `needsManualChoice`, say so explicitly and keep the candidate list visible.

- [ ] **Step 4: Implement edit and save.**

Allow editing name, description, category, keywords, variables, and body. Save through IPC, refresh the list, and keep the panel open with a success message. Do not expose raw filesystem paths in the normal panel.

- [ ] **Step 5: Compile and launch manually.**

Run `pnpm build && pnpm start`. Expected: an Electron panel opens; searching “决定” shows the seeded steelman prompt; choosing it copies text and attempts to paste.

- [ ] **Step 6: Commit the UI.**

Run `git add src/renderer.ts index.html styles.css && git commit -m "feat: add prompt search and routing panel"`.

## Task 7: Seed the user's 12 prompts and document setup

**Files:**
- Create: `prompts/01-socratic-questioning.md`
- Create: `prompts/02-two-layer-explanation.md`
- Create: `prompts/03-reverse-deconstruction.md`
- Create: `prompts/04-horizontal-vertical-analysis.md`
- Create: `prompts/05-fact-checking.md`
- Create: `prompts/06-expert-consultation.md`
- Create: `prompts/07-first-principles.md`
- Create: `prompts/08-cross-domain-solution.md`
- Create: `prompts/09-two-sided-steelman.md`
- Create: `prompts/10-minimum-experiment.md`
- Create: `prompts/11-hidden-talents.md`
- Create: `prompts/12-life-design.md`
- Create: `README.md`

- [ ] **Step 1: Add the 12 supplied prompt templates.**

Copy the prompt bodies from the user's pasted source, preserving the `【】` placeholders. Add concise metadata and Chinese trigger keywords for each template; do not add claims about the author or invent missing content.

- [ ] **Step 2: Document operation and permissions.**

README must explain `pnpm install`, `pnpm start`, the default hotkey, macOS Accessibility permission, Windows paste limitations, the Markdown format, and how to select an iCloud/OneDrive directory after the first launch. State that AI routing is optional and requires a separately configured OpenAI-compatible endpoint.

- [ ] **Step 3: Verify seeding and files.**

Run `find prompts -name '*.md' | wc -l` and expect `12`. Run `pnpm test` and expect all tests to pass.

- [ ] **Step 4: Commit the prompt library and docs.**

Run `git add prompts README.md && git commit -m "feat: seed personal prompt library"`.

## Task 8: End-to-end verification and release checks

**Files:**
- Modify: `README.md` only if verification exposes a missing instruction.

- [ ] **Step 1: Run the full automated suite.**

Run `pnpm test`. Expected: all parser, store, search, rendering, and routing tests pass.

- [ ] **Step 2: Run the production TypeScript build.**

Run `pnpm build`. Expected: exit code 0 and `dist/main.js`, `dist/preload.js`, and `dist/renderer.js` exist.

- [ ] **Step 3: Perform the macOS manual smoke test.**

Run `pnpm start`, press `Command+Control+Shift+Space`, search “犹豫”, open the steelman prompt, confirm it, and verify that the clipboard contains the rendered prompt. Test once in TextEdit and once in a browser text box. If Accessibility is denied, verify the visible clipboard fallback.

- [ ] **Step 4: Check packaging configuration.**

Run `pnpm exec electron-builder --dir`. Expected: an unpacked application directory is produced without missing `index.html`, `styles.css`, or `prompts/` files. Do not claim a signed distributable until signing credentials and a Windows build host are available.

- [ ] **Step 5: Review the final diff and commit verification docs if changed.**

Run `git status --short` and `git log --oneline -8`. The working tree should contain only intentional source, test, prompt, and documentation files.

## Self-review checklist

- The design requirement for editable Markdown files is covered by Tasks 2, 3, and 7.
- Search, manual override, auto-routing, and AI fallback are covered by Tasks 3, 4, and 6.
- Global hotkey, clipboard, and best-effort insertion are covered by Tasks 5, 6, and 8.
- Local sync-folder operation and conflict-safe backup are covered by Tasks 3, 5, and 7.
- Mac/Windows build configuration is covered by Tasks 1, 5, and 8.
- No task silently sends user questions to an AI service.
- No placeholder task wording is used; each task names files, commands, expected results, and concrete interfaces.

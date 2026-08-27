import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { watch as watchDirectory } from "node:fs";
import { join, basename } from "node:path";
import { parsePromptMarkdown, serializePromptMarkdown } from "./frontmatter";
import type { Prompt } from "./types";

export class PromptStore {
  private errors: string[] = [];

  constructor(private readonly directory: string) {}

  async loadAll(): Promise<Prompt[]> {
    await mkdir(this.directory, { recursive: true });
    this.errors = [];
    const entries = await readdir(this.directory, { withFileTypes: true });
    const prompts: Prompt[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md") || entry.name.endsWith(".bak")) continue;
      const fileName = entry.name;
      try {
        const source = await readFile(join(this.directory, fileName), "utf8");
        prompts.push(parsePromptMarkdown(fileName, source));
      } catch (error) {
        this.errors.push(`${fileName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return prompts.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }

  async save(prompt: Prompt): Promise<Prompt> {
    await mkdir(this.directory, { recursive: true });
    const fileName = basename(prompt.fileName.toLowerCase().endsWith(".md") ? prompt.fileName : `${prompt.fileName}.md`);
    const target = join(this.directory, fileName);
    try {
      await stat(target);
      await copyFile(target, `${target}.bak`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporary, serializePromptMarkdown({ ...prompt, fileName }), "utf8");
      await rename(temporary, target);
    } finally {
      try { await unlink(temporary); } catch { /* The atomic rename already removed it. */ }
    }

    return parsePromptMarkdown(fileName, await readFile(target, "utf8"));
  }

  readErrors(): string[] {
    return [...this.errors];
  }

  watch(onChange: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watcher = watchDirectory(this.directory, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onChange, 120);
    });
    return () => {
      if (timer) clearTimeout(timer);
      watcher.close();
    };
  }
}

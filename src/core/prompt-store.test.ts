import { mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PromptStore } from "./prompt-store";

async function tempPromptDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "prompt-router-test-"));
}

describe("PromptStore", () => {
  it("loads markdown prompts and skips non-markdown files", async () => {
    const directory = await tempPromptDir();
    await writeFile(join(directory, "one.md"), "---\nname: 一个\n---\n\n正文", "utf8");
    await writeFile(join(directory, "notes.txt"), "不要加载", "utf8");

    const store = new PromptStore(directory);
    const prompts = await store.loadAll();

    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.name).toBe("一个");
  });

  it("does not create a missing read-only prompt directory", async () => {
    const root = await tempPromptDir();
    const directory = join(root, "bundled-prompts");
    const store = new PromptStore(directory);

    await expect(store.loadAll({ ensureDirectory: false })).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("backs up an existing prompt before saving", async () => {
    const directory = await tempPromptDir();
    const filePath = join(directory, "one.md");
    await writeFile(filePath, "---\nname: 旧\n---\n\n旧正文\n", "utf8");
    const store = new PromptStore(directory);
    const [prompt] = await store.loadAll();

    await store.save({ ...prompt!, name: "新", body: "新正文" });

    expect(await readFile(`${filePath}.bak`, "utf8")).toContain("旧正文");
    expect(await readFile(filePath, "utf8")).toContain("新正文");
  });

  it("reports malformed files without deleting them", async () => {
    const directory = await tempPromptDir();
    const malformedPath = join(directory, "broken.md");
    await writeFile(malformedPath, "---\nname: broken\nkeywords: [broken\n---\n\nbody", "utf8");
    const store = new PromptStore(directory);

    const prompts = await store.loadAll();

    expect(prompts).toHaveLength(0);
    expect(store.readErrors()).toHaveLength(1);
    expect(await readdir(directory)).toContain("broken.md");
  });
});

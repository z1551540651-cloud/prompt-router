import { describe, expect, it } from "vitest";
import { shouldReopenPanel } from "./use-feedback";

describe("use prompt feedback", () => {
  it("reopens the panel when automatic paste fails", () => {
    expect(shouldReopenPanel({ clipboardReady: true, pasted: false, message: "已复制到剪贴板" })).toBe(true);
  });

  it("keeps the panel hidden after automatic paste succeeds", () => {
    expect(shouldReopenPanel({ clipboardReady: true, pasted: true, message: "已插入当前输入框" })).toBe(false);
  });
});

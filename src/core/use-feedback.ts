import type { PasteResult } from "./types";

export function shouldReopenPanel(result: PasteResult): boolean {
  return !result.pasted;
}

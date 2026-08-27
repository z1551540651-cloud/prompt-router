export function normalizeRouteText(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/[\s，。！？、；：,.!?;:：]+/g, "");
}

export function containsPhrase(query: string, phrase: string): boolean {
  const normalizedQuery = normalizeRouteText(query);
  const normalizedPhrase = normalizeRouteText(phrase);
  return Boolean(normalizedQuery && normalizedPhrase)
    && (normalizedQuery.includes(normalizedPhrase) || normalizedPhrase.includes(normalizedQuery));
}

export function sharedNgramScore(query: string, example: string): number {
  const normalizedQuery = normalizeRouteText(query);
  const normalizedExample = normalizeRouteText(example);
  if (normalizedQuery.length < 2 || normalizedExample.length < 2) return 0;

  const exampleGrams = new Set<string>();
  for (let index = 0; index < normalizedExample.length - 1; index += 1) {
    exampleGrams.add(normalizedExample.slice(index, index + 2));
  }

  const queryGrams = new Set<string>();
  for (let index = 0; index < normalizedQuery.length - 1; index += 1) {
    queryGrams.add(normalizedQuery.slice(index, index + 2));
  }

  let hits = 0;
  for (const gram of queryGrams) if (exampleGrams.has(gram)) hits += 1;
  return hits / Math.max(1, Math.min(queryGrams.size, exampleGrams.size));
}

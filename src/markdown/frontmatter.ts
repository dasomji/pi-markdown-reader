import type { FrontmatterSummary } from "./types.js";

export function findFrontmatter(lines: string[]): FrontmatterSummary | undefined {
  if (lines.length === 0 || !/^---\s*$/.test(lines[0] ?? "")) return undefined;

  for (let index = 1; index < lines.length; index += 1) {
    if (/^(---|\.\.\.)\s*$/.test(lines[index] ?? "")) {
      const rawLines = lines.slice(1, index);
      const keys = rawLines
        .map((line) => line.match(/^([A-Za-z0-9_.-]+)\s*:/)?.[1])
        .filter((key): key is string => Boolean(key));
      const endLine = index + 1;

      return {
        pathSlug: "frontmatter",
        keys: [...new Set(keys)],
        startLine: 1,
        endLine,
        lineCount: endLine,
      };
    }
  }

  return undefined;
}

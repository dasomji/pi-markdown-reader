import { findFrontmatter } from "./frontmatter.js";
import { slugSegment } from "./path-slugs.js";
import type { Heading, ParsedMarkdown } from "./types.js";

interface RawHeading {
  level: number;
  title: string;
  startLine: number;
  pathSlug: string;
}

export function splitMarkdownLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized.length === 0) return [];
  const withoutFinalNewline = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return withoutFinalNewline.split("\n");
}

export function parseMarkdown(text: string): ParsedMarkdown {
  const lines = splitMarkdownLines(text);
  const frontmatter = findFrontmatter(lines);
  const rawHeadings = scanHeadings(lines, frontmatter?.endLine ?? 0, Boolean(frontmatter));
  const headings = computeHeadingSpans(rawHeadings, lines.length);
  const firstH1 = rawHeadings.find((heading) => heading.level === 1);

  return {
    title: firstH1?.title,
    frontmatter,
    frontmatterKeys: frontmatter?.keys,
    totalLines: lines.length,
    lines,
    headings,
  };
}

function scanHeadings(lines: string[], frontmatterEndLine: number, hasFrontmatter: boolean): RawHeading[] {
  const headings: Omit<RawHeading, "pathSlug">[] = [];
  let fenceMarker: "`" | "~" | undefined;
  let fenceLength = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index] ?? "";

    if (lineNumber <= frontmatterEndLine) continue;

    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const markerRun = fenceMatch[1] ?? "";
      const marker = markerRun[0] as "`" | "~";
      if (!fenceMarker) {
        fenceMarker = marker;
        fenceLength = markerRun.length;
      } else if (marker === fenceMarker && markerRun.length >= fenceLength) {
        fenceMarker = undefined;
        fenceLength = 0;
      }
      continue;
    }

    if (fenceMarker) continue;

    const headingMatch = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/);
    if (!headingMatch) continue;

    const level = (headingMatch[1] ?? "").length;
    const title = (headingMatch[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
    if (!title) continue;

    headings.push({ level, title, startLine: lineNumber });
  }

  return assignPathSlugs(headings, hasFrontmatter);
}

function assignPathSlugs(headings: Omit<RawHeading, "pathSlug">[], hasFrontmatter: boolean): RawHeading[] {
  const stack: RawHeading[] = [];
  const siblingCounts = new Map<string, number>();
  if (hasFrontmatter) siblingCounts.set("\u0000frontmatter", 1);
  const result: RawHeading[] = [];

  for (const heading of headings) {
    while (stack.length > 0 && stack[stack.length - 1]!.level >= heading.level) {
      stack.pop();
    }

    const parentPathSlug = stack[stack.length - 1]?.pathSlug;
    const baseSegment = slugSegment(heading.title);
    const counterKey = `${parentPathSlug ?? ""}\u0000${baseSegment}`;
    const previousCount = siblingCounts.get(counterKey) ?? 0;
    siblingCounts.set(counterKey, previousCount + 1);

    const segment = previousCount === 0 ? baseSegment : `${baseSegment}-${previousCount}`;
    const rawHeading = {
      ...heading,
      pathSlug: parentPathSlug ? `${parentPathSlug}/${segment}` : segment,
    };

    result.push(rawHeading);
    stack.push(rawHeading);
  }

  return result;
}

function computeHeadingSpans(rawHeadings: RawHeading[], totalLines: number): Heading[] {
  return rawHeadings.map((heading, index) => {
    let endLine = totalLines;

    for (let nextIndex = index + 1; nextIndex < rawHeadings.length; nextIndex += 1) {
      const nextHeading = rawHeadings[nextIndex]!;
      if (nextHeading.level <= heading.level) {
        endLine = nextHeading.startLine - 1;
        break;
      }
    }

    return {
      ...heading,
      endLine,
      lineCount: Math.max(0, endLine - heading.startLine + 1),
    };
  });
}

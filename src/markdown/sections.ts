import type { Heading, ParsedMarkdown, SectionRead } from "./types.js";

export const DEFAULT_MAX_SECTION_LINES = 2_000;
export const DEFAULT_MAX_SECTION_BYTES = 50 * 1024;

const encoder = new TextEncoder();

export function readSectionByPathSlug(parsed: ParsedMarkdown, pathSlug: string): SectionRead {
  if (parsed.frontmatter?.pathSlug === pathSlug) {
    return readSection(parsed, {
      level: 0,
      title: "Frontmatter",
      pathSlug: parsed.frontmatter.pathSlug,
      startLine: parsed.frontmatter.startLine,
      endLine: parsed.frontmatter.endLine,
      lineCount: parsed.frontmatter.lineCount,
    });
  }

  const heading = parsed.headings.find((candidate) => candidate.pathSlug === pathSlug);
  if (!heading) {
    const available = [parsed.frontmatter?.pathSlug, ...parsed.headings.map((candidate) => candidate.pathSlug)]
      .filter(Boolean)
      .join(", ");
    throw new Error(`No Markdown heading found for pathSlug "${pathSlug}".${available ? ` Available pathSlugs: ${available}` : ""}`);
  }

  return readSection(parsed, heading);
}

function readSection(parsed: ParsedMarkdown, heading: Heading): SectionRead {
  const sectionLines = parsed.lines.slice(heading.startLine - 1, heading.endLine);
  const truncated = truncateLines(sectionLines);
  const nextLine = truncated.truncated ? heading.startLine + truncated.returnedLines : undefined;

  return {
    heading,
    content: truncated.content,
    truncated: truncated.truncated,
    totalLines: heading.lineCount,
    returnedLines: truncated.returnedLines,
    nextLine: nextLine && nextLine <= heading.endLine ? nextLine : undefined,
  };
}

function truncateLines(lines: string[]): { content: string; truncated: boolean; returnedLines: number } {
  const selected: string[] = [];
  let bytes = 0;
  let truncated = false;

  for (const line of lines) {
    if (selected.length >= DEFAULT_MAX_SECTION_LINES) {
      truncated = true;
      break;
    }

    const separatorBytes = selected.length > 0 ? 1 : 0;
    const lineBytes = encoder.encode(line).length;

    if (bytes + separatorBytes + lineBytes > DEFAULT_MAX_SECTION_BYTES) {
      const remainingBytes = DEFAULT_MAX_SECTION_BYTES - bytes - separatorBytes;
      if (remainingBytes > 0) {
        selected.push(truncateStringToBytes(line, remainingBytes));
      }
      truncated = true;
      break;
    }

    selected.push(line);
    bytes += separatorBytes + lineBytes;
  }

  if (selected.length < lines.length) truncated = true;

  return {
    content: selected.join("\n"),
    truncated,
    returnedLines: selected.length,
  };
}

function truncateStringToBytes(value: string, maxBytes: number): string {
  let result = "";
  let bytes = 0;

  for (const char of value) {
    const charBytes = encoder.encode(char).length;
    if (bytes + charBytes > maxBytes) break;
    result += char;
    bytes += charBytes;
  }

  return result;
}

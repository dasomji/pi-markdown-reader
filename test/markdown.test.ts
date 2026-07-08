import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/markdown/parse.js";
import { readSectionByPathSlug } from "../src/markdown/sections.js";
import { readMarkdownText } from "../src/tools/fs.js";
import { createMarkdownReadTool } from "../src/tools/markdown-read.js";

const fixtureDir = join(import.meta.dirname, "fixtures");

async function parseFixture(name: string) {
  const text = await readFile(join(fixtureDir, name), "utf8");
  return parseMarkdown(text);
}

describe("markdown parser", () => {
  it("extracts headings, path slugs, spans, and total lines", async () => {
    const parsed = await parseFixture("report.md");

    expect(parsed.totalLines).toBe(48);
    expect(parsed.title).toBe("Abstract");
    expect(parsed.frontmatter).toEqual({
      pathSlug: "frontmatter",
      keys: ["title", "tags"],
      startLine: 1,
      endLine: 5,
      lineCount: 5,
    });
    expect(parsed.frontmatterKeys).toEqual(["title", "tags"]);
    expect(parsed.headings[0]).toEqual({
      level: 1,
      title: "Abstract",
      pathSlug: "abstract",
      startLine: 6,
      endLine: 21,
      lineCount: 16,
    });
  });

  it("ignores headings inside fenced code blocks", async () => {
    const parsed = await parseFixture("report.md");
    expect(parsed.headings.map((heading) => heading.title)).not.toContain("Ignored fenced heading");
  });

  it("preserves source heading order as a flat pre-order outline", async () => {
    const parsed = await parseFixture("report.md");
    expect(parsed.headings.slice(0, 6).map((heading) => heading.pathSlug)).toEqual([
      "abstract",
      "abstract/bla",
      "abstract/blabla",
      "findings",
      "findings/bla",
      "findings/blubb",
    ]);
  });

  it("creates sibling-scoped duplicate path slugs", async () => {
    const parsed = await parseFixture("report.md");
    expect(parsed.headings.map((heading) => heading.pathSlug)).toEqual([
      "abstract",
      "abstract/bla",
      "abstract/blabla",
      "findings",
      "findings/bla",
      "findings/blubb",
      "duplicate",
      "duplicate-1",
      "duplicate-1/duplicate",
      "duplicate-1/duplicate-1",
    ]);
  });

  it("reserves the frontmatter pathSlug when a top-level heading is also named Frontmatter", () => {
    const parsed = parseMarkdown("---\ntitle: Test\n---\n# Frontmatter\n\nHeading content.\n");
    expect(parsed.frontmatter?.pathSlug).toBe("frontmatter");
    expect(parsed.headings[0]?.pathSlug).toBe("frontmatter-1");
  });

  it("respects maxDepth while keeping spans computed from the whole document", async () => {
    const text = await readFile(join(fixtureDir, "report.md"), "utf8");
    const parsed = parseMarkdown(text, { maxDepth: 1 });
    expect(parsed.headings.map((heading) => heading.pathSlug)).toEqual([
      "abstract",
      "findings",
      "duplicate",
      "duplicate-1",
    ]);
    expect(parsed.headings[0]?.endLine).toBe(21);
  });
});

describe("markdown section reads", () => {
  it("reads one requested section by required pathSlug", async () => {
    const parsed = await parseFixture("report.md");
    const section = readSectionByPathSlug(parsed, "findings/blubb");

    expect(section.heading.title).toBe("Blubb");
    expect(section.content).toBe("## Blubb\n\nFinding blubb.\n");
    expect(section.totalLines).toBe(4);
    expect(section.truncated).toBe(false);
  });

  it("includes subsections until the next same-or-higher-level heading", async () => {
    const parsed = await parseFixture("report.md");
    const section = readSectionByPathSlug(parsed, "abstract");

    expect(section.content).toContain("# Abstract");
    expect(section.content).toContain("## Bla");
    expect(section.content).toContain("## Blabla");
    expect(section.content).not.toContain("# Findings");
  });

  it("throws a clear error for unknown path slugs", async () => {
    const parsed = await parseFixture("report.md");
    expect(() => readSectionByPathSlug(parsed, "missing")).toThrow(/No Markdown heading found/);
  });

  it("strips a leading @ from input paths", async () => {
    const file = await readMarkdownText("@test/fixtures/report.md", process.cwd());
    expect(file.displayPath).toBe("test/fixtures/report.md");
  });

  it("handles frontmatter without confusing line numbers", async () => {
    const parsed = await parseFixture("report.md");
    expect(parsed.headings[0]?.startLine).toBe(6);
  });

  it("reads frontmatter by pathSlug", async () => {
    const parsed = await parseFixture("report.md");
    const section = readSectionByPathSlug(parsed, "frontmatter");

    expect(section.heading).toEqual({
      level: 0,
      title: "Frontmatter",
      pathSlug: "frontmatter",
      startLine: 1,
      endLine: 5,
      lineCount: 5,
    });
    expect(section.content).toBe("---\ntitle: Fixture Report\ntags:\n  - test\n---");
  });

  it("tool content returns plain Markdown text, with metadata only in details", async () => {
    const tool = createMarkdownReadTool();
    const result = await tool.execute(
      "test-call",
      { path: "test/fixtures/report.md", sections: [{ pathSlug: "findings/blubb" }] },
      undefined,
      undefined,
      { cwd: process.cwd() },
    );

    expect(result.content).toEqual([{ type: "text", text: "## Blubb\n\nFinding blubb.\n" }]);
    expect(result.details.sections[0].heading.pathSlug).toBe("findings/blubb");
  });
});

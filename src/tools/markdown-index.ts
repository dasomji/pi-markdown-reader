import { Type } from "typebox";
import { parseMarkdown } from "../markdown/parse.js";
import { displayPathFor, listMarkdownFiles, readMarkdownText } from "./fs.js";

export const markdownIndexParameters = Type.Object({
  path: Type.String({ description: "Directory or Markdown file to index. A leading @ is ignored." }),
  glob: Type.Optional(Type.String({ description: "Glob to match Markdown files. Defaults to **/*.md." })),
  maxFiles: Type.Optional(Type.Number({ minimum: 1, maximum: 500, description: "Maximum files to index. Defaults to 100." })),
  maxDepth: Type.Optional(Type.Number({ minimum: 1, maximum: 6, description: "Maximum heading depth to include. Defaults to 6." })),
});

export interface MarkdownIndexParams {
  path: string;
  glob?: string;
  maxFiles?: number;
  maxDepth?: number;
}

export function createMarkdownIndexTool() {
  return {
    name: "markdown_index",
    label: "Markdown Index",
    description: "Index a directory of Markdown files without reading full bodies. Returns file paths, line counts, frontmatter keys, and compact heading outlines.",
    promptSnippet: "Index Markdown files in a directory without reading full bodies.",
    promptGuidelines: [
      "Use markdown_index to inspect folders of Markdown reports, notes, or generated artifacts before choosing files for markdown_outline and markdown_read.",
    ],
    parameters: markdownIndexParameters,

    async execute(_toolCallId: string, params: MarkdownIndexParams, _signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
      const maxFiles = Math.min(Math.max(Math.floor(params.maxFiles ?? 100), 1), 500);
      const listing = await listMarkdownFiles(params.path, ctx.cwd, params.glob ?? "**/*.md", maxFiles);
      const files = [];

      for (const absolutePath of listing.files) {
        const file = await readMarkdownText(absolutePath, ctx.cwd);
        const parsed = parseMarkdown(file.text, { maxDepth: params.maxDepth, includeFrontmatter: true });
        files.push({
          path: displayPathFor(absolutePath, ctx.cwd),
          title: parsed.title,
          lineCount: parsed.totalLines,
          headings: parsed.headings,
          frontmatter: parsed.frontmatter,
          frontmatterKeys: parsed.frontmatterKeys,
        });
      }

      const output = {
        root: displayPathFor(listing.root, ctx.cwd),
        files,
        truncated: listing.truncated,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        details: output,
      };
    },
  };
}

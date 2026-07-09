import { Type } from "typebox";
import { parseMarkdown } from "../markdown/parse.js";
import { readMarkdownText } from "./fs.js";

export const markdownOutlineParameters = Type.Object({
  path: Type.String({ description: "Markdown file path. A leading @ is ignored." }),
  includeFrontmatter: Type.Optional(Type.Boolean({ description: "Include frontmatter as a reserved pathSlug when present. Defaults to true." })),
  verbose: Type.Optional(Type.Boolean({ description: "Include titles, frontmatter keys, line numbers, line counts, and totalLines for use with other line-oriented tools. Defaults to false." })),
});

export interface MarkdownOutlineParams {
  path: string;
  includeFrontmatter?: boolean;
  verbose?: boolean;
}

export function createMarkdownOutlineTool() {
  return {
    name: "markdown_outline",
    label: "Markdown Outline",
    description: "Extract a deterministic Markdown table of contents for one Markdown file. By default returns only heading levels and path slugs; verbose mode adds titles, frontmatter keys, line spans, and total line count.",
    promptSnippet: "Extract a compact Markdown table of contents for one Markdown file.",
    promptGuidelines: [
      "When working with a Markdown file, use markdown_outline first, then markdown_read with exact pathSlug values instead of raw line ranges.",
    ],
    parameters: markdownOutlineParameters,

    async execute(_toolCallId: string, params: MarkdownOutlineParams, _signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
      const file = await readMarkdownText(params.path, ctx.cwd);
      const parsed = parseMarkdown(file.text, {
        includeFrontmatter: params.includeFrontmatter,
      });

      const output = params.verbose
        ? {
            path: file.displayPath,
            title: parsed.title,
            frontmatter: parsed.frontmatter,
            totalLines: parsed.totalLines,
            headings: parsed.headings,
          }
        : {
            path: file.displayPath,
            frontmatter: parsed.frontmatter ? { level: 0, pathSlug: parsed.frontmatter.pathSlug } : undefined,
            headings: parsed.headings.map((heading) => ({
              level: heading.level,
              pathSlug: heading.pathSlug,
            })),
          };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        details: output,
      };
    },
  };
}

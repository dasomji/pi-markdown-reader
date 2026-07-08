import { Type } from "typebox";
import { parseMarkdown } from "../markdown/parse.js";
import { readMarkdownText } from "./fs.js";

export const markdownOutlineParameters = Type.Object({
  path: Type.String({ description: "Markdown file path. A leading @ is ignored." }),
  maxDepth: Type.Optional(Type.Number({ minimum: 1, maximum: 6, description: "Maximum heading depth to include. Defaults to 6." })),
  includeFrontmatter: Type.Optional(Type.Boolean({ description: "Include a bounded frontmatter summary. Defaults to true." })),
});

export interface MarkdownOutlineParams {
  path: string;
  maxDepth?: number;
  includeFrontmatter?: boolean;
}

export function createMarkdownOutlineTool() {
  return {
    name: "markdown_outline",
    label: "Markdown Outline",
    description: "Extract a deterministic Markdown table of contents with heading levels, path slugs, line spans, and total line count.",
    promptSnippet: "Extract a Markdown table of contents with heading levels, path slugs, line spans, and total line count.",
    promptGuidelines: [
      "Use markdown_outline before reading long Markdown files or generated reports.",
    ],
    parameters: markdownOutlineParameters,

    async execute(_toolCallId: string, params: MarkdownOutlineParams, _signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
      const file = await readMarkdownText(params.path, ctx.cwd);
      const parsed = parseMarkdown(file.text, {
        maxDepth: params.maxDepth,
        includeFrontmatter: params.includeFrontmatter,
      });

      const output = {
        path: file.displayPath,
        title: parsed.title,
        frontmatter: parsed.frontmatter,
        totalLines: parsed.totalLines,
        headings: parsed.headings,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        details: output,
      };
    },
  };
}

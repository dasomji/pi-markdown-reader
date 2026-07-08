import { Type } from "typebox";
import { parseMarkdown } from "../markdown/parse.js";
import { readSectionByPathSlug } from "../markdown/sections.js";
import { readMarkdownText } from "./fs.js";

export const markdownReadParameters = Type.Object({
  path: Type.String({ description: "Markdown file path. A leading @ is ignored." }),
  sections: Type.Array(
    Type.Object({
      pathSlug: Type.String({ description: "Exact pathSlug returned by markdown_outline." }),
    }),
    { minItems: 1, description: "Sections to read by exact pathSlug." },
  ),
});

export interface MarkdownReadParams {
  path: string;
  sections: Array<{ pathSlug: string }>;
}

export function createMarkdownReadTool() {
  return {
    name: "markdown_read",
    label: "Markdown Read",
    description: "Read one or more complete Markdown sections by exact pathSlug. Each section includes descendant subsections and is hard-truncated only for output safety.",
    promptSnippet: "Read one or more Markdown sections by exact path slug.",
    promptGuidelines: [
      "Use markdown_read to inspect specific headings by pathSlug instead of guessing line ranges with read, head, tail, or sed. Always pass requested headings in a sections array, even for one section.",
      "markdown_read only accepts exact pathSlug selectors from markdown_outline; call a subsection's own pathSlug when you only need that subsection.",
    ],
    parameters: markdownReadParameters,

    async execute(_toolCallId: string, params: MarkdownReadParams, _signal: AbortSignal | undefined, _onUpdate: unknown, ctx: { cwd: string }) {
      const file = await readMarkdownText(params.path, ctx.cwd);
      const parsed = parseMarkdown(file.text);
      const sections = params.sections.map((section) => readSectionByPathSlug(parsed, section.pathSlug));
      const output = {
        path: file.displayPath,
        totalLines: parsed.totalLines,
        sections,
      };

      return {
        content: [{ type: "text", text: sections.map((section) => section.content).join("\n\n") }],
        details: output,
      };
    },
  };
}

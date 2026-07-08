import { createMarkdownIndexTool } from "./tools/markdown-index.js";
import { createMarkdownOutlineTool } from "./tools/markdown-outline.js";
import { createMarkdownReadTool } from "./tools/markdown-read.js";

interface ExtensionAPI {
  registerTool(tool: unknown): void;
}

export default function markdownReaderExtension(pi: ExtensionAPI) {
  pi.registerTool(createMarkdownOutlineTool());
  pi.registerTool(createMarkdownReadTool());
  pi.registerTool(createMarkdownIndexTool());
}

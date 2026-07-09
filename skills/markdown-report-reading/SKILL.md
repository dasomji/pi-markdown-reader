---
name: markdown-report-reading
description: Read long Markdown reports, plans, notes, and generated artifacts using structure-aware Pi Markdown Reader tools. Use when analyzing Markdown files or directories where an outline-first, section-by-section workflow is safer than raw line-range reads.
license: MIT
---

# Markdown Report Reading

Use this workflow when the task involves understanding a Markdown file or a directory of Markdown reports, plans, notes, or generated artifacts.

## Core workflow

1. **Start with structure, not raw reads.**
   - For a single Markdown file, call `markdown_outline` first.
   - For a directory or unknown corpus, call `markdown_index` first, then `markdown_outline` on relevant files.
2. **Choose exact sections from returned slugs.**
   - Use the exact `pathSlug` values returned by `markdown_outline`.
   - Prefer the most specific subsection that answers the question.
3. **Read complete sections.**
   - Call `markdown_read` with `sections: [{ "pathSlug": "..." }]`.
   - Put every requested heading in the `sections` array, even when reading one section.
4. **Only fall back to generic file reads when needed.**
   - Avoid `read`, `head`, `tail`, `sed`, or guessed line ranges for long Markdown files unless the Markdown tools cannot answer the need.

## When to use each tool

- `markdown_index`: inspect a directory of Markdown files before deciding what matters.
- `markdown_outline`: inspect one file's heading tree and obtain exact section slugs.
- `markdown_read`: read selected sections and their descendant content by exact slug.

## Reporting back

When summarizing findings from Markdown reports:

- Mention the file path and relevant section titles or slugs.
- Separate direct evidence from interpretation.
- If more context may exist in unread sibling sections, say so rather than implying the entire document was read.

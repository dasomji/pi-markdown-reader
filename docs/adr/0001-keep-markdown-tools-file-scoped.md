# Keep Markdown tools file-scoped

The Markdown reader exposes only file-scoped tools: `markdown_outline({ path })` for one Markdown file and `markdown_read({ path, sections })` for complete sections from that same kind of file. We intentionally removed directory indexing, globbing, max-file limits, and outline depth filtering because agents can choose files with existing file-search tools and call the Markdown tools once per file.

`markdown_outline` keeps `verbose` because its line metadata can help an agent coordinate with other tools, but frontmatter is always included when present rather than controlled by an option. `markdown_read` intentionally accepts multiple sections and deduplicates descendants already covered by selected ancestors; that is the correct behavior for reading a coherent set of requested sections without repeated content.

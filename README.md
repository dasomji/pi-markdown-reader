# pi-markdown-reader

Pi extension tools for deterministic, structure-aware Markdown reading.

Instead of sampling long Markdown files with brittle line ranges, agents can inspect a compact outline first, then read complete sections by exact `pathSlug`.

## Install

```bash
pi install npm:@wienerberliner/pi-markdown-reader
```

Then restart Pi or run `/reload`.

## Tools

### `markdown_outline`

Returns a flat, source-ordered table of contents for a Markdown file:

- heading level and title
- hierarchical `pathSlug`
- `startLine`, `endLine`, and `lineCount`
- optional frontmatter metadata (`pathSlug`, keys, line span)

Example:

```json
{
  "path": "report.md",
  "includeFrontmatter": true
}
```

### `markdown_read`

Reads one or more complete Markdown sections by exact `pathSlug`.

The LLM-facing result is plain Markdown text. Metadata stays in tool details.

Example:

```json
{
  "path": "report.md",
  "sections": [
    { "pathSlug": "abstract" },
    { "pathSlug": "results/evidence" }
  ]
}
```

If a document has YAML frontmatter, it can be read with:

```json
{ "pathSlug": "frontmatter" }
```

### `markdown_index`

Indexes a directory of Markdown files without reading full bodies. Useful for folders of reports, notes, and generated artifacts.

## Development

```bash
npm install
npm test
npm run typecheck
```

For local Pi development in this repository, trust the project and reload Pi. The project `.pi/settings.json` shadows the published npm package and loads the local checkout.

## License

MIT

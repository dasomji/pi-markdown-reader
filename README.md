# pi-markdown-reader

Pi extension tools for deterministic, structure-aware Markdown reading.

Instead of sampling long Markdown files with brittle line ranges, agents can inspect a compact outline first, then read complete sections by exact `pathSlug`.

## Install

Install the published npm package:

```bash
pi install npm:@wienerberliner/pi-markdown-reader
```

Package: [`@wienerberliner/pi-markdown-reader`](https://www.npmjs.com/package/@wienerberliner/pi-markdown-reader)

Then restart Pi or run `/reload`.

## Tools

### `markdown_outline`

Returns a flat, source-ordered table of contents for a Markdown file.

By default the output is intentionally compact:

- heading `level`
- hierarchical `pathSlug`
- optional frontmatter entry as `{ "level": 0, "pathSlug": "frontmatter" }`

Example:

```json
{
  "path": "report.md"
}
```

Use verbose mode when the agent needs line numbers for other tools:

```json
{
  "path": "report.md",
  "verbose": true
}
```

Verbose mode adds titles, frontmatter keys, `startLine`, `endLine`, `lineCount`, and `totalLines`.

### `markdown_read`

Reads one or more complete Markdown sections by exact `pathSlug`.

If a request includes both a heading and one of its descendant subheadings, `markdown_read` returns the ancestor content once and omits the redundant descendant selection.

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

## Bundled skill

This package also includes the `markdown-report-reading` skill. It teaches agents an outline-first workflow for long Markdown reports and directories: index or outline first, select exact `pathSlug` values, then read complete sections with `markdown_read` instead of guessing line ranges.

## Development

```bash
npm install
npm test
npm run typecheck
```

For local Pi development in this repository, trust the project and reload Pi. The project `.pi/settings.json` shadows the published npm package and loads the local checkout.

## Publishing

Pushing a commit to `main` with a new `package.json` version automatically publishes that version to npm. If the version is already published, the workflow skips `npm publish`.

The workflow uses npm Trusted Publishing, so npm package settings must allow GitHub Actions for `dasomji/pi-markdown-reader` and workflow `publish.yml`.

## License

MIT

# Handoff: `pi-markdown-reader`

Date: 2026-07-08  
Location: `/home/dev/Development/pi-daniel/extensions/pi-markdown-reader`

## Goal

Build a Pi extension that gives agents deterministic, structure-aware tools for reading Markdown documents by heading instead of by brittle fixed line ranges.

The core idea: treat long Markdown reports like academic papers. Agents should first inspect a compact outline/table of contents, then read only the relevant sections such as `Abstract`, `Results`, `Problems encountered`, or `Evidence`. Agents can request verbose outline metadata with line spans only when they need to use other line-oriented tools.

## Motivation / evidence

A session-history check found that Pi/Claude/Codex agents usually read unstructured documents with generic slicing/search tools:

- `sed -n '1,220p'`
- `head -40`
- `tail -20`
- `grep` / `rg`
- `wc -l`
- `nl -ba | sed -n ...`
- Pi/Claude `read` offsets/limits

Small Markdown files are often read whole, but long docs, generated reports and corpora are searched/sampled rather than read end-to-end. No past-session evidence showed a structured Markdown outline/section reader.

Relevant artifact from the prior investigation:

- `/home/dev/Development/pi-daniel/extensions/archimedes-subagents/.pi-subagents/artifacts/outputs/0f4f63b8/.pi-subagents/artifacts/session-reading-patterns-historian.md`

## Peek-tool decision

Do **not** build a separate generic `peek` tool in v1.

Reason: for local text/log files, `peek` mostly formalizes what agents already do with `read`, `grep`, `head`, `tail`, `sed`, and shell pipelines. The new value here is not “bounded arbitrary slices”; Pi already has that. The new value is **semantic Markdown navigation**.

What `peek` would add if reconsidered later:

- a shell-free, sandbox-safe way to read bounded head/tail/around-match slices;
- uniform JSON return shape with truncation metadata;
- support for non-local artifact stores where shell access is unavailable;
- safer defaults for logs/session JSONL/stdout/stderr.

Those are useful, but not enough to justify v1 scope. Preserve room for a later `text_peek`/`artifact_peek` if the extension grows beyond Markdown.

## Pi extension docs already checked

Read Pi extension docs before this handoff:

- `/home/dev/.local/share/mise/installs/node/22.22.2/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`

Important implementation notes from docs:

- Extensions export a default function receiving `ExtensionAPI`.
- Register tools with `pi.registerTool()`.
- Use `typebox` schemas and `StringEnum` from `@earendil-works/pi-ai` for enums if needed.
- Custom tools must truncate output to avoid context bloat. But since this is a deliberate reading tool this is not avalid constraint for this tool.
- If a custom tool accepts paths, normalize a leading `@` because models often include it.
- Extensions in this workspace are not automatically active just because they live under `extensions/`; project or user settings will need to point at the extension once implemented.

## Proposed package shape

```text
pi-markdown-reader/
  HANDOFF.md
  package.json
  src/
    index.ts
    markdown/
      parse.ts
      headings.ts
      sections.ts
      path-slugs.ts
      frontmatter.ts
    tools/
      markdown-outline.ts
      markdown-read.ts         # reads 1+ requested sections
      markdown-index.ts        # optional but recommended
    test/
      fixtures/
      markdown-outline.test.ts
      markdown-read.test.ts
```

Suggested `package.json` style:

```json
{
  "name": "pi-markdown-reader",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "pi": {
    "extensions": ["./src/index.ts"]
  },
  "dependencies": {
    "typebox": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Keep dependencies minimal. A Markdown parser is optional; heading extraction can be deterministic with a small line scanner.

## V1 tools

### 1. `markdown_outline`

Return a deterministic table of contents for a Markdown file. The default outline should stay compact: it tells the agent each heading's level and path slug in source order so it can choose a `pathSlug` and call `markdown_read`. A `verbose` option returns titles, frontmatter keys, line spans, and total line count for cases where the agent wants to use other line-oriented tools against the Markdown file.

Input:

```ts
{
  path: string;
  maxDepth?: number;            // default: 6
  includeFrontmatter?: boolean; // default: true
  verbose?: boolean;            // default: false
}
```

Default output shape:

```ts
{
  path: string;
  frontmatter?: {
    level: 0;
    pathSlug: "frontmatter";
  };
  headings: Array<{
    level: number;      // number of # characters in the heading marker
    pathSlug: string;   // hierarchical slug, e.g. "results/latency"
  }>;
}
```

Verbose output shape (`verbose: true`):

```ts
{
  path: string;
  title?: string;
  frontmatter?: {
    pathSlug: "frontmatter";
    keys: string[];
    startLine: number;
    endLine: number;
    lineCount: number;
  };
  totalLines: number;
  headings: Array<{
    level: number;
    title: string;
    pathSlug: string;
    startLine: number;
    endLine: number;
    lineCount: number;
  }>;
}
```

Behavior:

- Parse ATX headings (`#`, `##`, etc.).
- Ignore headings inside fenced code blocks.
- `level` is exactly the count of leading `#` characters.
- By default, return only `level` and `pathSlug` for headings to avoid bloating the main outline/read workflow.
- In verbose mode, include `startLine`, `endLine`, and `lineCount` for each heading so agents can see how much content a `markdown_read` call would return and can use line-bounded shell tools if needed.
- In verbose mode, a heading's `endLine` is the line before the next heading of the same or higher level, or EOF for the final section. Descendant subsections are part of the section span.
- Generate deterministic hierarchical `pathSlug` values, with duplicate suffixes scoped to siblings (`results/summary`, `proposal/summary`, `results/summary-1`, etc.).
- Preserve document order in the returned `headings` array. The outline should be a flat pre-order traversal of the Markdown document, for example `abstract`, `abstract/bla`, `abstract/blabla`, `findings`, `findings/bla`, `findings/blubb`.
- Include compact frontmatter metadata by default if present: `level: 0` and reserved `pathSlug: "frontmatter"`. In verbose mode, also include top-level keys and line span metadata. Do not parse or return per-key JSON values in the outline.
- Reserve the top-level `frontmatter` path slug when a file has frontmatter; if the document also has a heading named `Frontmatter`, that heading should receive a duplicate suffix such as `frontmatter-1`.

### 2. `markdown_read`

Read one or more Markdown sections by explicit path slug. There is intentionally no separate singular and plural tool: the request payload always contains a `sections` array, which may have one or many entries.

Input:

```ts
{
  path: string;
  sections: Array<{
    pathSlug: string;
  }>;
}
```

Tool content output:

Plain Markdown text for the requested section span(s), not JSON. For a single requested section, return exactly the selected lines joined with normal newlines. For multiple requested sections, return their selected text blocks in request order separated by a blank line.

Tool `details` metadata:

```ts
{
  path: string;
  totalLines: number;
  sections: Array<{
    heading: {
      level: number;
      title: string;
      pathSlug: string;
      startLine: number;
      endLine: number;
      lineCount: number;
    };
    content: string;
    truncated: boolean;
    totalLines: number;
    returnedLines: number;
    nextLine?: number;
  }>;
}
```

`details` keeps metadata for UI/session/debugging, but the LLM-facing `content` should be the raw Markdown section text so agents can read it naturally without JSON bloat.

Behavior:

- Resolve sections only by exact `pathSlug`. Do not support title matching or line-number selection in `markdown_read`; those are intentionally less explicit.
- If the document has frontmatter, `markdown_read` accepts the reserved `frontmatter` path slug and returns the complete frontmatter block, including delimiters.
- Always include the selected heading's full section span, including all descendant subsections, until the next heading of the same or higher level or EOF.
- If the agent wants only a subsection, it should call `markdown_read` with that subsection's own `pathSlug`.
- Keep line metadata in tool `details`; do not include JSON metadata in the LLM-facing text content.
- Batch use is the normal case, for example reading `abstract` and `results` together. A one-section read still uses `sections: [{ pathSlug: ... }]`.

Primary use:

```json
{
  "path": "report.md",
  "sections": [
    { "pathSlug": "abstract" },
    { "pathSlug": "results" }
  ]
}
```

### 3. `markdown_index`

Index a directory of Markdown files without reading full bodies.

Input:

```ts
{
  path: string;
  glob?: string;          // default: "**/*.md"
  maxFiles?: number;      // default bounded
  maxDepth?: number;      // heading depth to include
}
```

Output:

```ts
{
  root: string;
  files: Array<{
    path: string;
    title?: string;
    lineCount: number;
    headings: Array<{ level: number; title: string; pathSlug: string; startLine: number; endLine: number; lineCount: number }>;
    frontmatter?: { pathSlug: "frontmatter"; keys: string[]; startLine: number; endLine: number; lineCount: number };
    frontmatterKeys?: string[];
  }>;
  truncated: boolean;
}
```

This is useful for folders of subagent reports, issue docs, Obsidian notes, transcript exports, and generated research artifacts.

## Report convention to pair with this extension

Subagents should be instructed to write Markdown reports with predictable top-level headings:

```md
# Abstract

Short overview of what was investigated and the conclusion.

# Results

The actionable answer or final outcome.

# Problems encountered

Failures, blocked commands, missing files, unavailable tools, etc.

# Ambiguity encountered

Open questions, assumptions, and places where requirements could be interpreted multiple ways.

# Evidence

Citations, file paths, command outputs, tests, source references.

# Detailed findings

Full analysis, details, alternatives considered.

# Appendix

Raw logs, long excerpts, secondary notes.
```

Parent-agent default behavior should be:

1. `markdown_outline(report.md)`
2. `markdown_read({ path: "report.md", sections: [{ pathSlug: "abstract" }, { pathSlug: "results" }] })`
3. Only drill into `Problems encountered`, `Ambiguity encountered`, `Evidence`, or `Detailed findings` if needed.

## Implementation details / algorithms

### Heading scanner

Use a line scanner rather than a full Markdown AST for v1.

Rules:

- Track fenced code blocks starting with triple backticks or tildes.
- Ignore ATX-looking headings inside fences.
- Recognize headings matching roughly: `^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$`.
- Strip trailing closing hashes from title.
- Preserve original title text and also compute normalized path slug.
- Compute heading spans with a stack or next-heading scan. A heading span includes descendant subsections and ends before the next same-or-higher-level heading.

### Path slugs

Implement deterministic hierarchical Markdown slugs:

- normalize each heading segment GitHub-style:
  - lowercase;
  - trim;
  - remove most punctuation;
  - spaces to `-`;
  - collapse duplicate `-`;
- join ancestor heading segments with `/`, for example `results/latency/failure-cases`;
- preserve heading order from the source document; path slugs describe hierarchy but must not cause alphabetical sorting;
- duplicate headings under the same ancestor get sibling-scoped suffixes `-1`, `-2`, etc.;
- do not return separate `parentSlug` or `path` fields in v1.

Exact GitHub parity is less important than determinism and clear returned path slugs.

### Path safety

- Resolve paths relative to `ctx.cwd`.
- Strip a leading `@` from path input.
- Do not allow reading directories with `markdown_read`.
- Return clear errors for missing files, binary-ish files, and non-UTF8 decode failures.

### Truncation

Follow Pi extension docs:

- Tool outputs must be bounded.
- Use built-in truncation utilities if practical: `truncateHead`, `DEFAULT_MAX_LINES`, `DEFAULT_MAX_BYTES`, `formatSize` from `@earendil-works/pi-coding-agent`.
- `markdown_read` semantically targets the complete selected section span, including descendant subsections. Only hard safety truncation should make the returned content partial; when that happens, set `truncated: true` and return `nextLine`.

## Tests / acceptance criteria

Minimum tests:

1. Return compact `markdown_outline` output by default with only `level` and `pathSlug` for headings.
2. Return verbose `markdown_outline` output when requested, including headings, titles, `startLine`, `endLine`, `lineCount`, and document `totalLines`.
3. Ignore headings inside fenced code blocks.
4. Handle duplicate headings with deterministic path slugs.
5. Preserve source heading order in the flat outline output.
6. Read one requested section via a one-item `sections` array containing a required `pathSlug`.
7. Read multiple requested sections via the same `sections` array.
8. Always include subsections until the next same-or-higher-level heading.
9. Return a clear not-found error for unknown `pathSlug` values.
10. Return plain Markdown text from `markdown_read` content, with metadata only in `details`.
11. Enforce hard output truncation if needed and return `nextLine` in details.
12. Strip leading `@` from paths.
13. Expose compact frontmatter metadata in default `markdown_outline`, with keys and line span added in verbose mode.
14. Read the complete frontmatter block via `markdown_read` using `pathSlug: "frontmatter"`.
15. Handle frontmatter without confusing heading line numbers.

Manual Pi acceptance test:

1. Load extension with `pi -e ./src/index.ts` from this folder or configure it in settings.
2. Ask the agent to inspect a long Markdown report.
3. Confirm it calls `markdown_outline` first rather than `read` with arbitrary offsets.
4. Confirm it reads `Abstract`/`Results` only, then drills into another section on request.

## Tool prompt guidance

Each registered tool should have a short prompt snippet and explicit guideline. Example:

- `markdown_outline`: “Extract a compact Markdown table of contents with heading levels and path slugs. Use `verbose: true` when line spans are needed for other tools.”
- `markdown_read`: “Read one or more Markdown sections by exact path slug.”

Prompt guidelines should name the tool explicitly:

- “Use `markdown_outline` before reading long Markdown files or generated reports. Keep the default compact output unless you need `verbose: true` line metadata for other tools.”
- “Use `markdown_read` to inspect specific headings by `pathSlug` instead of guessing line ranges with `read`, `head`, `tail`, or `sed`. Always pass requested headings in a `sections` array, even for one section.”

## Non-goals for v1

- No generic `peek` tool.
- No separate singular/plural section tools; `markdown_read.sections` is always an array.
- No Markdown rewriting/editing.
- No full CommonMark parser unless simple scanning proves insufficient.
- No semantic summarization; tools are deterministic readers only.
- No automatic replacement/override of Pi’s built-in `read` tool.

## Open questions for implementer

1. Should reports use `# Abstract` as H1 or `## Abstract` under a document title? Recommendation: support both; parent report convention can use top-level headings for simplicity.
2. Should the extension include a bundled skill/instruction for subagent report structure? Recommendation: maybe later; start with tools only and document the convention.

## Current status

Implemented as a local Pi package with three tools:

- `markdown_outline`
- `markdown_read`
- `markdown_index`

Development files now include `package.json`, `tsconfig.json`, `.pi/settings.json`, source files under `src/`, and Vitest coverage under `test/`. The project-local `.pi/settings.json` loads `..` so trusted Pi sessions in this folder can pick up the local checkout after `/reload` or restart.

Validation completed:

- `npm test` (13 tests passing)
- `npm run typecheck`
- `pi list --approve` confirms project package `..` resolves to this checkout.
- `pi -e ./src/index.ts --list-models nonsense` exits successfully, confirming the extension loads.

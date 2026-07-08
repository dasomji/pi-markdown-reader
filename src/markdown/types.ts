export interface Heading {
  level: number;
  title: string;
  pathSlug: string;
  startLine: number;
  endLine: number;
  lineCount: number;
}

export interface FrontmatterSummary {
  pathSlug: "frontmatter";
  keys: string[];
  startLine: number;
  endLine: number;
  lineCount: number;
}

export interface ParsedMarkdown {
  title?: string;
  frontmatter?: FrontmatterSummary;
  frontmatterKeys?: string[];
  totalLines: number;
  lines: string[];
  headings: Heading[];
}

export interface SectionRead {
  heading: Heading;
  content: string;
  truncated: boolean;
  totalLines: number;
  returnedLines: number;
  nextLine?: number;
}

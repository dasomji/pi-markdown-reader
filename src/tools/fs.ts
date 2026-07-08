import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";

export interface MarkdownFile {
  absolutePath: string;
  displayPath: string;
  text: string;
}

export function normalizeInputPath(inputPath: string, cwd: string): string {
  const withoutAt = inputPath.startsWith("@") ? inputPath.slice(1) : inputPath;
  return isAbsolute(withoutAt) ? resolve(withoutAt) : resolve(cwd, withoutAt);
}

export async function readMarkdownText(inputPath: string, cwd: string): Promise<MarkdownFile> {
  const absolutePath = normalizeInputPath(inputPath, cwd);
  const stats = await stat(absolutePath).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read Markdown file ${inputPath}: ${message}`);
  });

  if (stats.isDirectory()) {
    throw new Error(`Cannot read Markdown file ${inputPath}: path is a directory`);
  }

  if (!stats.isFile()) {
    throw new Error(`Cannot read Markdown file ${inputPath}: path is not a regular file`);
  }

  const buffer = await readFile(absolutePath);
  if (buffer.includes(0)) {
    throw new Error(`Cannot read Markdown file ${inputPath}: file appears to be binary`);
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error(`Cannot read Markdown file ${inputPath}: file is not valid UTF-8`);
  }

  return {
    absolutePath,
    displayPath: displayPathFor(absolutePath, cwd),
    text,
  };
}

export async function listMarkdownFiles(inputPath: string, cwd: string, glob: string, maxFiles: number): Promise<{ root: string; files: string[]; truncated: boolean }> {
  const root = normalizeInputPath(inputPath, cwd);
  const stats = await stat(root).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot index Markdown path ${inputPath}: ${message}`);
  });

  if (stats.isFile()) {
    return { root, files: [root], truncated: false };
  }

  if (!stats.isDirectory()) {
    throw new Error(`Cannot index Markdown path ${inputPath}: path is not a file or directory`);
  }

  const matcher = globMatcher(glob);
  const files: string[] = [];
  let truncated = false;

  async function visit(directory: string): Promise<void> {
    if (files.length >= maxFiles) {
      truncated = true;
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }

      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".pi") continue;

      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        const rel = relative(root, absolute).split(sep).join("/");
        if (matcher(rel)) files.push(absolute);
      }
    }
  }

  await visit(root);
  return { root, files, truncated };
}

export function displayPathFor(absolutePath: string, cwd: string): string {
  const relativePath = relative(cwd, absolutePath);
  if (!relativePath.startsWith("..") && !isAbsolute(relativePath)) return relativePath || ".";
  return absolutePath;
}

function globMatcher(glob: string): (relativePath: string) => boolean {
  if (glob === "**/*.md") return (relativePath) => relativePath.endsWith(".md");
  if (glob === "**/*.{md,markdown}") return (relativePath) => /\.(md|markdown)$/i.test(relativePath);

  const regex = new RegExp(`^${escapeGlob(glob)}$`);
  return (relativePath) => regex.test(relativePath);
}

function escapeGlob(glob: string): string {
  let output = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];

    if (char === "*" && next === "*") {
      output += ".*";
      index += 1;
    } else if (char === "*") {
      output += "[^/]*";
    } else if (char === "?") {
      output += "[^/]";
    } else {
      output += escapeRegex(char ?? "");
    }
  }
  return output;
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

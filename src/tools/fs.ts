import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
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

  const extension = extname(absolutePath).toLowerCase();
  if (extension !== ".md" && extension !== ".markdown") {
    throw new Error(`Cannot read Markdown file ${inputPath}: file extension must be .md or .markdown`);
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

export function displayPathFor(absolutePath: string, cwd: string): string {
  const relativePath = relative(cwd, absolutePath);
  if (!relativePath.startsWith("..") && !isAbsolute(relativePath)) return relativePath || ".";
  return absolutePath;
}

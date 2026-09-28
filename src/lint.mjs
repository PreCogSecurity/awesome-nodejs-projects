/**
 * Repository style linter.
 *
 * Deliberately dependency-free. This repository's entire product is a data
 * file and its documentation, so the toolchain has no third-party code in it
 * at all: there is no supply-chain surface, no lockfile drift, and
 * `npm ci` is instant and works offline. The rules below encode the
 * conventions documented in CONTRIBUTING.md.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import config from '../lint.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.mjs',
  '.js',
  '.json',
  '.yml',
  '.yaml',
  '.example',
  '.gitignore',
  '.editorconfig',
  '.nvmrc',
  '.tf',
]);

const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'coverage', '.terraform']);

const { style } = config;

/**
 * The line-length cap that applies to a given file.
 * @param {string} file
 * @returns {number}
 */
export function lineLimitFor(file) {
  return style.maxLineLengthByExtension?.[path.extname(file)] ?? style.maxLineLength;
}

/**
 * @typedef {{ file: string, line: number | null, rule: string, message: string }} LintFinding
 */

/**
 * Lint a single file's contents.
 * @param {string} file repo-relative path, used in messages
 * @param {string} contents
 * @returns {LintFinding[]}
 */
export function lintContents(file, contents) {
  /** @type {LintFinding[]} */
  const findings = [];

  const add = (line, rule, message) => findings.push({ file, line, rule, message });

  if (contents.includes('\u0000')) {
    add(null, 'nul-byte', 'File contains a NUL byte.');
  }
  if (style.forbidTabs && /^\t/m.test(contents)) {
    const line = contents.split('\n').findIndex((candidate) => candidate.startsWith('\t')) + 1;
    add(line, 'tab-indent', 'Use spaces for indentation.');
  }
  if (style.forbidTrailingWhitespace) {
    contents.split('\n').forEach((text, offset) => {
      if (/[ \t]+$/.test(text)) {
        add(offset + 1, 'trailing-whitespace', 'Line has trailing whitespace.');
      }
    });
  }
  if (contents.includes('\r')) {
    add(null, 'crlf', 'File uses CRLF line endings; expected LF.');
  }
  if (style.requireFinalNewline) {
    if (contents !== '' && !contents.endsWith('\n')) {
      add(null, 'final-newline', 'File does not end with a newline.');
    } else if (contents.endsWith('\n\n')) {
      add(null, 'final-newline', 'File ends with more than one newline.');
    }
  }
  const lineLimit = lineLimitFor(file);
  if (contents !== '' && lineLimit > 0) {
    contents.split('\n').forEach((text, offset) => {
      if (text.length > lineLimit) {
        add(offset + 1, 'max-line-length', `Line is ${text.length} characters, limit is ${lineLimit}.`);
      }
    });
  }

  if (file.endsWith('.json') && contents.trim() !== '') {
    try {
      JSON.parse(contents);
    } catch (error) {
      add(null, 'json-parse', `Invalid JSON: ${error.message}`);
    }
  }

  return findings;
}

/**
 * Recursively collect lintable files.
 * @param {string} directory absolute path
 * @returns {Promise<string[]>} repo-relative paths
 */
export async function collectFiles(directory) {
  /** @type {string[]} */
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      // Dot-directories such as `.github` hold real, linted source. Only the
      // directories in SKIP_DIRECTORIES are excluded.
      files.push(...(await collectFiles(path.join(directory, entry.name))));
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name);
    if (TEXT_EXTENSIONS.has(extension) || entry.name.startsWith('.') || entry.name === 'Dockerfile') {
      files.push(path.relative(ROOT, path.join(directory, entry.name)).split(path.sep).join('/'));
    }
  }
  return files;
}

/**
 * @returns {Promise<LintFinding[]>}
 */
export async function lintRepository() {
  const files = (await collectFiles(ROOT)).sort();
  /** @type {LintFinding[]} */
  const findings = [];
  for (const file of files) {
    const absolute = path.join(ROOT, file);
    const info = await stat(absolute);
    if (info.size > style.maxFileBytes) {
      findings.push({
        file,
        line: null,
        rule: 'max-file-size',
        message: `File is ${info.size} bytes, limit is ${style.maxFileBytes}.`,
      });
      continue;
    }
    findings.push(...lintContents(file, await readFile(absolute, 'utf8')));
  }
  return findings;
}

/**
 * @param {LintFinding[]} findings
 * @returns {string}
 */
export function formatLintFindings(findings) {
  return findings
    .map((finding) => {
      const where = finding.file + (finding.line === null ? '' : `:${finding.line}`);
      return `  ${where} [${finding.rule}] ${finding.message}`;
    })
    .join('\n');
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  lintRepository()
    .then((findings) => {
      if (findings.length > 0) {
        console.error(`lint: ${findings.length} problem(s) found\n${formatLintFindings(findings)}`);
        process.exitCode = 1;
        return;
      }
      console.log('lint: no problems found.');
    })
    .catch((error) => {
      console.error(`lint: ${error.message}`);
      process.exitCode = 1;
    });
}

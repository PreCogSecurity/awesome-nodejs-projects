/**
 * README generation.
 *
 * The curated list lives in `data/projects.json`. README.md is a *build
 * artefact* for the list section only: everything outside the generated
 * markers is hand-written prose and is preserved verbatim.
 *
 * Keeping the data and the presentation separate is what makes the list
 * reviewable (a diff shows exactly which entries changed) and testable (the
 * validator runs against the data, not against rendered Markdown).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import config from '../lint.config.mjs';
import { loadCatalog } from './validate.mjs';

const BEGIN_MARKER = '<!-- BEGIN GENERATED LIST: edit data/projects.json, then run `npm run render` -->';
const END_MARKER = '<!-- END GENERATED LIST -->';

/** Markers delimiting the generated region of README.md. */
export const GENERATED_BLOCK = Object.freeze({ begin: BEGIN_MARKER, end: END_MARKER });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Render a single project entry.
 * @param {{ name: string, repo: string, website?: string, description: string }} project
 * @returns {string}
 */
export function renderProject(project) {
  const website = project.website === undefined ? '' : ` ([website](${project.website}))`;
  return `* [${project.name}](${project.repo})${website} - ${project.description}`;
}

/**
 * Render the whole list body, preserving the curated ordering of
 * `categories` and the entry ordering within each category.
 * @param {any} catalog
 * @returns {string}
 */
export function renderList(catalog) {
  /** @param {string} categoryId @returns {string[]} */
  const entriesFor = (categoryId) =>
    catalog.projects
      .filter((project) => project.category === categoryId)
      .map((project) => renderProject(project));

  const blocks = [];

  for (const category of catalog.categories) {
    blocks.push(`## ${category.title}`);

    // A category may hold entries directly *and* sub-sections; render both so
    // that adding a child never silently drops the parent's own entries.
    const directEntries = entriesFor(category.id);
    if (directEntries.length > 0) {
      blocks.push(directEntries.join('\n'));
    }

    for (const child of Array.isArray(category.children) ? category.children : []) {
      blocks.push(`**${child.title}**`);
      blocks.push(entriesFor(child.id).join('\n'));
    }
  }

  return `${BEGIN_MARKER}\n\n${blocks.join('\n\n')}\n\n${END_MARKER}`;
}

/**
 * Replace the generated block inside existing Markdown.
 * @param {string} markdown
 * @param {string} listBlock
 * @returns {string}
 */
export function spliceList(markdown, listBlock) {
  const begin = markdown.indexOf(BEGIN_MARKER);
  const end = markdown.indexOf(END_MARKER);

  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `README.md is missing the generated-list markers.\n  expected: ${BEGIN_MARKER}\n  expected: ${END_MARKER}`,
    );
  }

  const head = markdown.slice(0, begin);
  const tail = markdown.slice(end + END_MARKER.length);
  return `${head}${listBlock}${tail}`;
}

/**
 * @param {string} readmePath
 * @param {string} dataPath
 * @returns {Promise<string>} the expected README contents
 */
export async function buildReadme(
  readmePath = path.join(ROOT, config.paths.readme),
  dataPath = path.join(ROOT, config.paths.data),
) {
  const { data, findings } = await loadCatalog(dataPath);
  if (findings.length > 0) {
    const detail = findings.map((f) => `  ${f.location} [${f.rule}] ${f.message}`).join('\n');
    throw new Error(`Refusing to render an invalid catalog:\n${detail}`);
  }
  const markdown = await readFile(readmePath, 'utf8');
  return spliceList(markdown, renderList(data));
}

async function main() {
  const args = process.argv.slice(2);
  const readmePath = path.join(ROOT, config.paths.readme);

  const expected = await buildReadme(readmePath);
  const current = await readFile(readmePath, 'utf8');

  if (args.includes('--check')) {
    if (current !== expected) {
      console.error('README.md is out of date with data/projects.json.');
      console.error('Run `npm run render` and commit the result.');
      process.exitCode = 1;
      return;
    }
    console.log('README.md is up to date with data/projects.json.');
    return;
  }

  if (current === expected) {
    console.log('README.md already up to date; no changes written.');
    return;
  }
  await writeFile(readmePath, expected, 'utf8');
  console.log('README.md regenerated from data/projects.json.');
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

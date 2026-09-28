/**
 * Catalog validation.
 *
 * `data/projects.json` is untrusted input: it is edited by contributors via
 * pull requests and rendered into a document that a large audience clicks.
 * Every value therefore passes through a schema check, a URL safety check and
 * a set of curated-list content rules before it is allowed to reach README.md.
 *
 * Rules come from `lint.config.mjs` so that local runs, CI and the tests all
 * enforce exactly the same policy.
 */

import { readFile } from 'node:fs/promises';

import config from '../lint.config.mjs';

const {
  security: {
    requireHttps,
    allowedRepoHosts,
    deniedHostPatterns,
    forbidControlCharacters,
    bannedDescriptionTerms,
  },
  catalog: { schemaVersion, idPattern, maxDescriptionLength, maxNameLength },
} = config;

/** A repository URL must have at least owner/project segments. */
const REPO_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/\s]+\/[^/\s]+(?:\/[^/\s]+)*/i;

/**
 * Control and bidirectional-override characters that must never survive into
 * generated Markdown, where they can be used to spoof or reorder text.
 */
const CONTROL_CHARACTERS = new RegExp(
  '[' +
    '\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F' +
    '\\u007F-\\u009F\\u00AD\\u200B-\\u200F' +
    '\\u2028\\u2029\\u202A-\\u202E\\u2060\\u2066-\\u2069\\uFEFF' +
  ']',
);

/** Leading or trailing whitespace. */
const SURROUNDING_WHITESPACE = /^\s|\s$/;

/**
 * A single validation finding.
 * @typedef {{ location: string, rule: string, message: string }} Finding
 */

/**
 * @typedef {{ id: string, title: string, parent: string | null, hasChildren: boolean }} CategoryMeta
 */

/**
 * Parse and validate raw JSON text.
 * @param {string} text
 * @returns {{ data: unknown, findings: Finding[] }}
 */
export function parseCatalog(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return {
      data: undefined,
      findings: [{ location: '<root>', rule: 'json-parse', message: `Invalid JSON: ${error.message}` }],
    };
  }
  return { data, findings: validateCatalog(data) };
}

/**
 * Validate a parsed catalog object.
 * @param {unknown} data
 * @returns {Finding[]}
 */
export function validateCatalog(data) {
  /** @type {Finding[]} */
  const findings = [];
  /** @param {string} location @param {string} rule @param {string} message */
  const report = (location, rule, message) => findings.push({ location, rule, message });

  if (!isPlainObject(data)) {
    report('<root>', 'type', 'Catalog root must be a JSON object.');
    return findings;
  }

  if (data.schemaVersion !== schemaVersion) {
    report(
      'schemaVersion',
      'schema-version',
      `Expected ${schemaVersion}, received ${JSON.stringify(data.schemaVersion)}.`,
    );
  }

  /** @type {Map<string, CategoryMeta>} */
  const index = new Map();
  const seenIds = new Set();
  const seenTitles = new Map();

  if (!Array.isArray(data.categories) || data.categories.length === 0) {
    report('categories', 'type', '`categories` must be a non-empty array.');
  } else {
    data.categories.forEach((category, position) => {
      collectCategory(category, `categories[${position}]`, null, seenIds, seenTitles, index, report);
    });
  }

  if (!Array.isArray(data.projects) || data.projects.length === 0) {
    report('projects', 'type', '`projects` must be a non-empty array.');
    return findings;
  }

  const seenRepos = new Map();
  const seenNames = new Set();

  data.projects.forEach((project, position) => {
    const location = `projects[${position}]`;
    if (!isPlainObject(project)) {
      report(location, 'type', 'Project must be a JSON object.');
      return;
    }

    const meta = typeof project.category === 'string' ? index.get(project.category) : undefined;
    if (meta === undefined) {
      report(`${location}.category`, 'unknown-category', `Unknown category id ${JSON.stringify(project.category)}.`);
    }

    validateName(project.name, location, seenNames, report);

    const repoKey = validateUrl(project.repo, `${location}.repo`, true, report);
    if (repoKey !== undefined) {
      if (seenRepos.has(repoKey)) {
        report(
          `${location}.repo`,
          'duplicate-repo',
          `Duplicate repository, already listed at ${seenRepos.get(repoKey)}.`,
        );
      } else {
        seenRepos.set(repoKey, location);
      }
    }

    if (project.website !== undefined) {
      validateUrl(project.website, `${location}.website`, false, report);
    }

    validateDescription(project.description, location, report);
  });

  for (const [id, meta] of index) {
    if (meta.hasChildren) continue;
    const populated = data.projects.some((project) => isPlainObject(project) && project.category === id);
    if (!populated) {
      report(`categories.${id}`, 'empty-category', `Category "${id}" (${meta.title}) has no entries.`);
    }
  }

  return findings;
}

/**
 * Validate one category, recursing into its children.
 * @param {unknown} category
 * @param {string} location
 * @param {string | null} parentId
 * @param {Set<string>} seenIds
 * @param {Map<string, string>} seenTitles
 * @param {Map<string, CategoryMeta>} index
 * @param {(location: string, rule: string, message: string) => void} report
 */
function collectCategory(category, location, parentId, seenIds, seenTitles, index, report) {
  if (!isPlainObject(category)) {
    report(location, 'type', 'Category must be a JSON object.');
    return;
  }

  const id = category.id;
  if (typeof id !== 'string' || !idPattern.test(id)) {
    report(`${location}.id`, 'id-format', `Category id ${JSON.stringify(id)} must match ${idPattern}.`);
  } else if (seenIds.has(id)) {
    report(`${location}.id`, 'duplicate-id', `Category id "${id}" is already used.`);
  } else {
    seenIds.add(id);
  }

  const title = category.title;
  if (typeof title !== 'string' || title.trim() === '') {
    report(`${location}.title`, 'type', 'Category title must be a non-empty string.');
  } else {
    if (SURROUNDING_WHITESPACE.test(title)) {
      report(`${location}.title`, 'whitespace', 'Category title has surrounding whitespace.');
    }
    if (!/^\p{Lu}/u.test(title)) {
      report(`${location}.title`, 'title-capitalisation', 'Category title must start with a capital letter.');
    }
    const titleKey = title.toLowerCase();
    if (seenTitles.has(titleKey)) {
      report(
        `${location}.title`,
        'duplicate-title',
        `Duplicate category title, already used at ${seenTitles.get(titleKey)}.`,
      );
    } else {
      seenTitles.set(titleKey, location);
    }
  }

  const children = category.children;
  if (children !== undefined && !Array.isArray(children)) {
    report(`${location}.children`, 'type', '`children` must be an array when present.');
  }

  if (typeof id === 'string') {
    index.set(id, {
      title: typeof title === 'string' ? title : id,
      parent: parentId,
      hasChildren: Array.isArray(children) && children.length > 0,
    });
  }

  if (Array.isArray(children)) {
    children.forEach((child, position) => {
      collectCategory(child, `${location}.children[${position}]`, id, seenIds, seenTitles, index, report);
    });
  }
}

/**
 * @param {unknown} name
 * @param {string} location
 * @param {Set<string>} seenNames
 * @param {(location: string, rule: string, message: string) => void} report
 */
function validateName(name, location, seenNames, report) {
  if (typeof name !== 'string' || name.trim() === '') {
    report(`${location}.name`, 'type', 'Project name must be a non-empty string.');
    return;
  }
  if (SURROUNDING_WHITESPACE.test(name)) {
    report(`${location}.name`, 'whitespace', 'Project name has surrounding whitespace.');
  }
  if (name.length > maxNameLength) {
    report(`${location}.name`, 'length', `Project name exceeds ${maxNameLength} characters.`);
  }
  if (CONTROL_CHARACTERS.test(name)) {
    report(`${location}.name`, 'control-characters', 'Project name contains control characters.');
  }

  const key = name.toLowerCase();
  if (seenNames.has(key)) {
    report(`${location}.name`, 'duplicate-name', `Duplicate project name "${name}".`);
  } else {
    seenNames.add(key);
  }
}

/**
 * @param {unknown} description
 * @param {string} location
 * @param {(location: string, rule: string, message: string) => void} report
 */
function validateDescription(description, location, report) {
  if (typeof description !== 'string' || description.trim() === '') {
    report(`${location}.description`, 'type', 'Description must be a non-empty string.');
    return;
  }
  if (SURROUNDING_WHITESPACE.test(description)) {
    report(`${location}.description`, 'whitespace', 'Description has surrounding whitespace.');
  }
  if (CONTROL_CHARACTERS.test(description)) {
    report(
      `${location}.description`,
      'control-characters',
      'Description contains control or bidirectional control characters.',
    );
  }
  if (description.length > maxDescriptionLength) {
    report(`${location}.description`, 'length', `Description exceeds ${maxDescriptionLength} characters.`);
  }
  if (!/^\p{Lu}/u.test(description)) {
    report(`${location}.description`, 'capitalisation', 'Description must start with a capital letter.');
  }
  if (!description.endsWith('.')) {
    report(`${location}.description`, 'punctuation', 'Description must end with a full stop.');
  }
  for (const term of bannedDescriptionTerms) {
    if (term.test(description)) {
      report(
        `${location}.description`,
        'banned-term',
        'Description must not restate the ecosystem it is filed under.',
      );
    }
  }
}

/**
 * Validate an absolute URL and its safety properties.
 * @param {unknown} value
 * @param {string} location
 * @param {boolean} isRepositoryLink
 * @param {(location: string, rule: string, message: string) => void} report
 * @returns {string | undefined} normalised key used for duplicate detection
 */
function validateUrl(value, location, isRepositoryLink, report) {
  if (typeof value !== 'string' || value.trim() === '') {
    report(location, 'type', 'URL must be a non-empty string.');
    return undefined;
  }
  if (value !== value.trim()) {
    report(location, 'whitespace', 'URL has surrounding whitespace.');
  }
  if (CONTROL_CHARACTERS.test(value)) {
    report(location, 'control-characters', 'URL contains control characters.');
    return undefined;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    report(location, 'malformed-url', `Not a valid absolute URL: ${JSON.stringify(value)}.`);
    return undefined;
  }

  if (url.protocol === 'http:' && requireHttps) {
    report(
      location,
      'insecure-url',
      'Use https://; a plaintext link can be rewritten in transit by a network attacker.',
    );
  } else if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    report(location, 'url-scheme', `Only http(s) URLs are allowed, received "${url.protocol}".`);
  }

  if (url.username !== '' || url.password !== '') {
    report(location, 'embedded-credentials', 'URL must not embed credentials.');
  }

  for (const pattern of deniedHostPatterns) {
    if (pattern.test(url.hostname)) {
      report(location, 'denied-host', `Host "${url.hostname}" is not permitted in curated links.`);
    }
  }

  if (isRepositoryLink) {
    if (!REPO_URL_PATTERN.test(value)) {
      report(location, 'url-shape', 'URL must point at a repository, e.g. https://github.com/owner/project.');
    }
    if (!allowedRepoHosts.includes(url.hostname.toLowerCase())) {
      report(
        location,
        'repo-host',
        `Repository host "${url.hostname}" is not one of: ${allowedRepoHosts.join(', ')}.`,
      );
    }
  }

  return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();
}

/** @param {unknown} value */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read and validate the catalog from disk.
 * @param {string} filePath
 * @returns {Promise<{ data: any, findings: Finding[] }>}
 */
export async function loadCatalog(filePath) {
  const text = await readFile(filePath, 'utf8');
  return parseCatalog(text);
}

/**
 * Render findings as human-readable, greppable lines.
 * @param {Finding[]} findings
 * @returns {string}
 */
export function formatFindings(findings) {
  return findings.map((finding) => `  ${finding.location} [${finding.rule}] ${finding.message}`).join('\n');
}

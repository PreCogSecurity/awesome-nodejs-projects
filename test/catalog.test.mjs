/**
 * Integration tests over the repository's real contents.
 *
 * These assert the promises the README makes to a person who has just cloned
 * the repository: the curated data is valid, the published document matches the
 * data, nothing insecure is committed, and the toolchain has no third-party
 * code in it. They are the reason a fresh clone can be trusted.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import config from '../lint.config.mjs';
import { buildReadme } from '../src/render.mjs';
import { loadCatalog } from '../src/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(ROOT, relative), 'utf8');

const { data: catalog } = await loadCatalog(path.join(ROOT, config.paths.data));

/** Every category id, including nested children. */
function categoryIds(categories, collected = []) {
  for (const category of categories) {
    collected.push(category);
    categoryIds(category.children ?? [], collected);
  }
  return collected;
}

describe('curated data', () => {
  it('validates with zero findings', async () => {
    const { findings } = await loadCatalog(path.join(ROOT, config.paths.data));
    assert.deepEqual(
      findings.map((f) => `  ${f.location} [${f.rule}] ${f.message}`).join('\n'),
      '',
    );
  });

  it('is a non-trivial list', () => {
    assert.ok(catalog.projects.length >= 30, `expected a substantial list, got ${catalog.projects.length}`);
  });

  it('files every entry under a category that exists', () => {
    const known = new Set(categoryIds(catalog.categories).map((category) => category.id));
    for (const project of catalog.projects) {
      assert.ok(known.has(project.category), `unknown category ${project.category}`);
    }
  });

  it('gives every leaf category at least one entry', () => {
    for (const category of categoryIds(catalog.categories)) {
      const hasChildren = Array.isArray(category.children) && category.children.length > 0;
      if (hasChildren) continue;
      const populated = catalog.projects.some((project) => project.category === category.id);
      assert.ok(populated, `category ${category.id} is empty`);
    }
  });

  it('links every repository over https', () => {
    for (const project of catalog.projects) {
      assert.ok(project.repo.startsWith('https://'), `${project.name} repo is not https`);
      if (project.website !== undefined) {
        assert.ok(project.website.startsWith('https://'), `${project.name} website is not https`);
      }
    }
  });

  it('links only allowlisted repository hosts', () => {
    for (const project of catalog.projects) {
      const host = new URL(project.repo).hostname.toLowerCase();
      assert.ok(
        config.security.allowedRepoHosts.includes(host),
        `${project.name} points at non-allowlisted host ${host}`,
      );
    }
  });

  it('lists no repository twice', () => {
    const seen = new Set();
    for (const project of catalog.projects) {
      const key = new URL(project.repo).pathname.replace(/\/+$/, '').toLowerCase();
      assert.ok(!seen.has(key), `duplicate repository ${project.repo}`);
      seen.add(key);
    }
  });

  it('restates Node.js in no description', () => {
    for (const project of catalog.projects) {
      assert.doesNotMatch(project.description, /\bnode\.?js\b/i, project.name);
    }
  });

  it('embeds no credentials in any link', () => {
    for (const project of catalog.projects) {
      for (const url of [project.repo, project.website].filter((value) => value !== undefined)) {
        const parsed = new URL(url);
        assert.equal(parsed.username, '', `${project.name} leaks a username`);
        assert.equal(parsed.password, '', `${project.name} leaks a password`);
      }
    }
  });
});

describe('published README.md', () => {
  it('is byte-identical to what the renderer produces', async () => {
    // This is the "fresh clone works" guarantee: a contributor who edits the
    // data without regenerating cannot get a green build.
    assert.equal(await read(config.paths.readme), await buildReadme());
  });

  it('renders every curated entry', async () => {
    const readme = await read(config.paths.readme);
    for (const project of catalog.projects) {
      assert.ok(readme.includes(project.repo), `${project.name} is missing from README.md`);
    }
  });

  it('contains no plaintext link', async () => {
    assert.doesNotMatch(await read(config.paths.readme), /\]\(http:\/\//);
  });

  it('does not reference the retired rawgit CDN', async () => {
    // rawgit.com was shut down in 2018; the badge silently 404'd.
    assert.doesNotMatch(await read(config.paths.readme), /rawgit/i);
  });

  it('documents the commands a fresh clone needs', async () => {
    const readme = await read(config.paths.readme);
    for (const command of ['npm ci', 'npm run verify', 'npm test', 'npm run lint', 'npm run render']) {
      assert.ok(readme.includes(command), `README does not document \`${command}\``);
    }
  });
});

describe('repository hygiene', () => {
  it('has no third-party dependencies, so there is no supply-chain surface', async () => {
    const manifest = JSON.parse(await read('package.json'));
    assert.deepEqual(manifest.dependencies ?? {}, {});
    assert.deepEqual(manifest.devDependencies ?? {}, {});
  });

  it('cannot be published to a public registry by accident', async () => {
    const manifest = JSON.parse(await read('package.json'));
    assert.equal(manifest.private, true);
  });

  it('declares a supported Node.js range and pins one for developers', async () => {
    const manifest = JSON.parse(await read('package.json'));
    assert.match(manifest.engines.node, /^>=\d+\.\d+\.\d+$/);
    assert.match((await read('.nvmrc')).trim(), /^\d+$/);
  });

  it('ignores .env but keeps the example file', async () => {
    const ignored = await read('.gitignore');
    assert.match(ignored, /^\.env$/m);
    assert.match(ignored, /!\.env\.example$/m);
  });

  it('documents every compose variable in .env.example', async () => {
    const compose = await read('docker-compose.yml');
    const example = await read('.env.example');
    for (const match of compose.matchAll(/\$\{([A-Z0-9_]+)[^}]*\}/g)) {
      assert.ok(example.includes(`${match[1]}=`), `.env.example does not document ${match[1]}`);
    }
  });

  it('ships a complete licence, not a stub', async () => {
    const license = await read('LICENSE');
    assert.ok(license.length > 500, 'LICENSE is too short to be a real licence');
    assert.match(license, /Permission is hereby granted/);
    assert.match(license, /WITHOUT WARRANTY OF ANY KIND/);
  });

  it('excludes VCS history and secrets from the docker build context', async () => {
    const ignored = await read('.dockerignore');
    assert.match(ignored, /^\.git$/m);
    assert.match(ignored, /^\.env$/m);
    assert.match(ignored, /^node_modules$/m);
  });
});

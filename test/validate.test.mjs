/**
 * Tests for the catalog validator.
 *
 * Each rule in `lint.config.mjs` gets a test that proves it is actually
 * enforced. These are the security-relevant tests: they are what stops a
 * hostile or careless pull request from putting a downgraded, deceptive or
 * malformed link into a document that thousands of people read and click.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatFindings, parseCatalog, validateCatalog } from '../src/validate.mjs';

/** A minimal catalog that must validate with zero findings. */
function validCatalog() {
  return {
    schemaVersion: 1,
    categories: [
      { id: 'cms', title: 'CMS' },
      {
        id: 'devs',
        title: 'Developers',
        children: [{ id: 'electron-apps', title: 'Electron apps' }],
      },
    ],
    projects: [
      {
        category: 'cms',
        name: 'Alpha',
        repo: 'https://github.com/example/alpha',
        description: 'A first project.',
      },
      {
        category: 'electron-apps',
        name: 'Beta',
        repo: 'https://github.com/example/beta',
        website: 'https://beta.example/',
        description: 'A second project.',
      },
    ],
  };
}

/** Validate a mutated copy of the valid catalog and return the finding rules. */
function rulesFor(mutate) {
  const catalog = validCatalog();
  mutate(catalog);
  return validateCatalog(catalog).map((finding) => finding.rule);
}

describe('validateCatalog', () => {
  it('accepts a well-formed catalog', () => {
    assert.deepEqual(validateCatalog(validCatalog()), []);
  });

  it('accepts an entry filed directly under a category that also has sub-categories', () => {
    // Regression test: a parent category may hold entries of its own. A stricter
    // rule once rejected these, and the renderer silently dropped them.
    const rules = rulesFor((catalog) => {
      catalog.projects.push({
        category: 'devs',
        name: 'Gamma',
        repo: 'https://github.com/example/gamma',
        description: 'A third project.',
      });
    });
    assert.deepEqual(rules, []);
  });

  it('accepts an entry with no website', () => {
    const catalog = validCatalog();
    delete catalog.projects[1].website;
    assert.deepEqual(validateCatalog(catalog), []);
  });
});

describe('structural rules', () => {
  it('reports invalid JSON rather than throwing', () => {
    const { findings } = parseCatalog('{ not json');
    assert.equal(findings[0].rule, 'json-parse');
  });

  it('rejects a non-object root', () => {
    assert.deepEqual(validateCatalog([]).map((f) => f.rule), ['type']);
    assert.deepEqual(validateCatalog(null).map((f) => f.rule), ['type']);
    assert.deepEqual(validateCatalog('nope').map((f) => f.rule), ['type']);
  });

  it('rejects an unknown schemaVersion', () => {
    const rules = rulesFor((catalog) => {
      catalog.schemaVersion = 99;
    });
    assert.ok(rules.includes('schema-version'));
  });

  it('rejects duplicate category ids', () => {
    const rules = rulesFor((catalog) => {
      catalog.categories.push({ id: 'cms', title: 'Content' });
    });
    assert.ok(rules.includes('duplicate-id'));
  });

  it('rejects a category id that is not lowercase and dash separated', () => {
    const rules = rulesFor((catalog) => {
      catalog.categories[0].id = 'Chat Bots';
    });
    assert.ok(rules.includes('id-format'));
  });

  it('rejects a category title that does not start with a capital', () => {
    const rules = rulesFor((catalog) => {
      catalog.categories[0].title = 'cms';
    });
    assert.ok(rules.includes('title-capitalisation'));
  });

  it('rejects duplicate category titles', () => {
    const rules = rulesFor((catalog) => {
      catalog.categories.push({ id: 'other', title: 'CMS' });
      catalog.projects.push({
        category: 'other',
        name: 'Delta',
        repo: 'https://github.com/example/delta',
        description: 'A fourth project.',
      });
    });
    assert.ok(rules.includes('duplicate-title'));
  });

  it('rejects a category with neither entries nor sub-categories', () => {
    const rules = rulesFor((catalog) => {
      catalog.categories.push({ id: 'empty', title: 'Empty' });
    });
    assert.ok(rules.includes('empty-category'));
  });

  it('rejects an unknown category reference on an entry', () => {
    const rules = rulesFor((catalog) => {
      catalog.projects[0].category = 'does-not-exist';
    });
    assert.ok(rules.includes('unknown-category'));
  });

  it('rejects empty categories and project arrays', () => {
    assert.deepEqual(validateCatalog({ schemaVersion: 1, categories: [], projects: [] }).map((f) => f.rule), [
      'type',
      'type',
    ]);
  });
});

describe('field rules', () => {
  it('rejects a missing or blank name', () => {
    assert.ok(rulesFor((catalog) => delete catalog.projects[0].name).includes('type'));
    assert.ok(rulesFor((catalog) => (catalog.projects[0].name = '   ')).includes('type'));
  });

  it('rejects a missing or blank description', () => {
    assert.ok(rulesFor((catalog) => delete catalog.projects[0].description).includes('type'));
    assert.ok(rulesFor((catalog) => (catalog.projects[0].description = '')).includes('type'));
  });

  it('rejects a name with surrounding whitespace', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].name = ' Alpha'));
    assert.ok(rules.includes('whitespace'));
  });

  it('rejects duplicate project names', () => {
    const rules = rulesFor((catalog) => (catalog.projects[1].name = 'alpha'));
    assert.ok(rules.includes('duplicate-name'));
  });
});

describe('URL safety rules', () => {
  it('rejects a plaintext http repository link', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].repo = 'http://github.com/example/alpha'));
    assert.ok(rules.includes('insecure-url'));
  });

  it('rejects a plaintext http website link', () => {
    const rules = rulesFor((catalog) => (catalog.projects[1].website = 'http://beta.example/'));
    assert.ok(rules.includes('insecure-url'));
  });

  it('rejects non-http schemes such as javascript:', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].repo = 'javascript:alert(1)'));
    assert.ok(rules.includes('url-scheme'));
  });

  it('rejects a malformed URL', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].repo = 'github.com/example/alpha'));
    assert.ok(rules.includes('malformed-url'));
  });

  it('rejects credentials embedded in a URL', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].repo = 'https://user:token@github.com/example/alpha'));
    assert.ok(rules.includes('embedded-credentials'));
  });

  it('rejects a repository host outside the allowlist', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].repo = 'https://sourcehut.example/example/alpha'));
    assert.ok(rules.includes('repo-host'));
  });

  it('accepts every allowlisted repository host', () => {
    for (const host of ['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org']) {
      const rules = rulesFor((catalog) => (catalog.projects[0].repo = `https://${host}/example/alpha`));
      assert.deepEqual(rules, [], `${host} should be allowed`);
    }
  });

  it('rejects a dead or launderer host', () => {
    const rules = rulesFor((catalog) => (catalog.projects[1].website = 'https://cdn.rawgit.com/o/r/x.svg'));
    assert.ok(rules.includes('denied-host'));
  });

  it('rejects a URL that is not shaped like a repository', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].repo = 'https://github.com/'));
    assert.ok(rules.includes('url-shape'));
  });

  it('rejects a duplicate repository regardless of case and trailing slash', () => {
    const rules = rulesFor((catalog) => (catalog.projects[1].repo = 'https://GitHub.com/Example/Alpha/'));
    assert.ok(rules.includes('duplicate-repo'));
  });
});

describe('description rules', () => {
  it('rejects a description that does not start with a capital', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].description = 'a first project.'));
    assert.ok(rules.includes('capitalisation'));
  });

  it('rejects a description that does not end with a full stop', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].description = 'A first project'));
    assert.ok(rules.includes('punctuation'));
  });

  it('rejects a description that restates the ecosystem', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].description = 'A Node.js framework.'));
    assert.ok(rules.includes('banned-term'));
    const js = rulesFor((catalog) => (catalog.projects[0].description = 'A nodejs framework.'));
    assert.ok(js.includes('banned-term'));
  });

  it('does not confuse NodeSource with Node.js', () => {
    const rules = rulesFor(
      (catalog) => (catalog.projects[0].description = 'A CLI for NodeSource Certified Modules.'),
    );
    assert.deepEqual(rules, []);
  });

  it('rejects bidirectional override characters used to disguise text', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].description = 'A first project.\u202E gnitroc A'));
    assert.ok(rules.includes('control-characters'));
  });

  it('rejects an over-long description', () => {
    const rules = rulesFor((catalog) => (catalog.projects[0].description = `A${'x'.repeat(400)} project.`));
    assert.ok(rules.includes('length'));
  });
});

describe('formatFindings', () => {
  it('includes the location and the rule so CI logs are greppable', () => {
    const text = formatFindings(validateCatalog({ schemaVersion: 1, categories: [], projects: [] }));
    assert.match(text, /categories \[type\]/);
    assert.match(text, /projects \[type\]/);
  });
});

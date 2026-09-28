/**
 * Tests for the README renderer.
 *
 * The renderer decides what a large audience actually sees, so its ordering and
 * escaping behaviour is pinned here. A regression that silently drops entries is
 * far worse than a build failure, and would be invisible in review.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GENERATED_BLOCK, renderList, renderProject, spliceList } from '../src/render.mjs';

function catalog() {
  return {
    schemaVersion: 1,
    categories: [
      { id: 'cms', title: 'CMS' },
      {
        id: 'devs',
        title: 'Developers',
        children: [{ id: 'electron-apps', title: 'Electron apps' }],
      },
      { id: 'forms', title: 'Forms' },
    ],
    projects: [
      {
        category: 'cms',
        name: 'Alpha',
        repo: 'https://github.com/example/alpha',
        website: 'https://alpha.example/',
        description: 'A first project.',
      },
      {
        category: 'devs',
        name: 'Gamma',
        repo: 'https://github.com/example/gamma',
        description: 'A second project.',
      },
      {
        category: 'electron-apps',
        name: 'Beta',
        repo: 'https://github.com/example/beta',
        description: 'A third project.',
      },
    ],
  };
}

describe('renderProject', () => {
  it('renders name, repository, website and description', () => {
    assert.equal(
      renderProject({
        name: 'Alpha',
        repo: 'https://github.com/example/alpha',
        website: 'https://alpha.example/',
        description: 'A first project.',
      }),
      '* [Alpha](https://github.com/example/alpha) ([website](https://alpha.example/)) - A first project.',
    );
  });

  it('omits the website clause entirely when there is no website', () => {
    const line = renderProject({
      name: 'Gamma',
      repo: 'https://github.com/example/gamma',
      description: 'A second project.',
    });
    assert.equal(line, '* [Gamma](https://github.com/example/gamma) - A second project.');
    assert.doesNotMatch(line, /website/);
  });
});

describe('renderList', () => {
  it('wraps the body in the generated-block markers', () => {
    const output = renderList(catalog());
    assert.ok(output.startsWith(GENERATED_BLOCK.begin));
    assert.ok(output.endsWith(GENERATED_BLOCK.end));
  });

  it('emits categories as level-two headings, in catalog order', () => {
    const output = renderList(catalog());
    assert.ok(output.indexOf('## CMS') < output.indexOf('## Developers'));
    assert.ok(output.indexOf('## Developers') < output.indexOf('## Forms'));
  });

  it('emits a sub-category as a bold heading beneath its parent', () => {
    const output = renderList(catalog());
    assert.ok(output.indexOf('## Developers') < output.indexOf('**Electron apps**'));
  });

  it('keeps a parent category direct entries even when it has sub-categories', () => {
    // Regression test: the renderer once emitted only the children in this case
    // and silently dropped the parent's own entries from the published list.
    const output = renderList(catalog());
    assert.ok(output.includes('example/gamma'));
    assert.ok(output.includes('example/alpha'));
    assert.ok(output.includes('example/beta'));
  });

  it('preserves the curated ordering of entries within a category', () => {
    const output = renderList(catalog());
    assert.ok(output.indexOf('example/alpha') < output.indexOf('example/gamma'));
  });

  it('is deterministic', () => {
    assert.equal(renderList(catalog()), renderList(catalog()));
  });
});

describe('spliceList', () => {
  const existing = [
    '# Title',
    '',
    'Hand-written prose that must survive.',
    '',
    '## License',
    '',
    'Also hand-written.',
    '',
  ].join('\n');

  function withBlock(body) {
    const licenseAt = existing.indexOf('## License');
    const block = `${GENERATED_BLOCK.begin}\n\n${body}\n\n${GENERATED_BLOCK.end}`;
    return `${existing.slice(0, licenseAt)}\n${block}\n\n${existing.slice(licenseAt)}`;
  }

  it('replaces only the generated region and preserves surrounding prose', () => {
    const result = spliceList(withBlock('old content'), renderList(catalog()));
    assert.ok(result.includes('Hand-written prose that must survive.'));
    assert.ok(result.includes('Also hand-written.'));
    assert.ok(result.includes('example/alpha'));
    assert.ok(!result.includes('old content'));
  });

  it('is idempotent, so re-running the generator produces no diff', () => {
    const listBlock = renderList(catalog());
    const once = spliceList(withBlock('old content'), listBlock);
    assert.equal(spliceList(once, listBlock), once);
  });

  it('throws a clear error when the markers are missing', () => {
    assert.throws(() => spliceList('# No markers here\n', 'body'), /missing the generated-list markers/);
  });

  it('throws when the markers appear in the wrong order', () => {
    const inverted = `${GENERATED_BLOCK.end}\nbody\n${GENERATED_BLOCK.begin}\n`;
    assert.throws(() => spliceList(inverted, 'body'), /missing the generated-list markers/);
  });
});

/**
 * Tests for the style linter.
 *
 * The linter is the first gate contributors hit, so a rule that does not fire
 * on the thing it is meant to catch is worse than no rule at all.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatLintFindings, lintContents } from '../src/lint.mjs';

/** Rule names reported for a snippet of file contents. */
function rulesFor(contents, file = 'sample.md') {
  return lintContents(file, contents).map((finding) => finding.rule);
}

const CLEAN = '# Title\n\nA tidy line.\n';

describe('lintContents', () => {
  it('accepts a tidy file', () => {
    assert.deepEqual(lintContents('sample.md', CLEAN), []);
  });

  it('rejects trailing whitespace', () => {
    assert.deepEqual(rulesFor('# Title   \n'), ['trailing-whitespace']);
  });

  it('rejects CRLF line endings', () => {
    assert.deepEqual(rulesFor('# Title\r\n\r\nBody\r\n'), ['crlf']);
  });

  it('rejects a missing final newline', () => {
    assert.deepEqual(rulesFor('# Title\n\nBody'), ['final-newline']);
  });

  it('rejects a blank line at end of file', () => {
    assert.deepEqual(rulesFor('# Title\n\n\n'), ['final-newline']);
  });

  it('rejects tab indentation', () => {
    assert.deepEqual(rulesFor('const a = 1;\n\tconst b = 2;\n'), ['tab-indent']);
  });

  it('rejects a source line beyond the length limit', () => {
    assert.ok(rulesFor(`${'x'.repeat(130)}\n`, 'src/example.mjs').includes('max-line-length'));
  });

  it('applies a relaxed line limit to Markdown and JSON', () => {
    // A list entry is one line by convention; wrapping it would corrupt the
    // rendered output rather than improve it.
    const long = `${'x'.repeat(200)}\n`;
    assert.ok(!rulesFor(long, 'README.md').includes('max-line-length'));
    assert.ok(!rulesFor(long, 'data/projects.json').includes('max-line-length'));
  });

  it('still catches a genuinely runaway Markdown line', () => {
    assert.ok(rulesFor(`${'x'.repeat(400)}\n`, 'README.md').includes('max-line-length'));
  });

  it('reports the offending line number', () => {
    const finding = lintContents('sample.md', 'ok\nok\nbad   \n')[0];
    assert.equal(finding.line, 3);
    assert.equal(finding.file, 'sample.md');
  });

  it('rejects a NUL byte', () => {
    assert.ok(rulesFor(`# Title${String.fromCharCode(0)}\n`).includes('nul-byte'));
  });

  it('rejects invalid JSON', () => {
    assert.ok(rulesFor('{ "a": }\n', 'sample.json').includes('json-parse'));
  });

  it('accepts valid JSON', () => {
    assert.deepEqual(rulesFor('{\n  "a": 1\n}\n', 'sample.json'), []);
  });

  it('does not report a JSON parse error for a file that is not JSON', () => {
    assert.deepEqual(rulesFor('# Heading\n', 'sample.md'), []);
  });
});

describe('formatLintFindings', () => {
  it('renders file, line and rule so editors can jump to it', () => {
    const text = formatLintFindings(lintContents('README.md', 'bad   \n'));
    assert.match(text, /README\.md:1 \[trailing-whitespace]/);
  });

  it('omits the line for file-level findings', () => {
    const text = formatLintFindings(lintContents('README.md', 'no newline'));
    assert.match(text, /README\.md \[final-newline]/);
  });
});

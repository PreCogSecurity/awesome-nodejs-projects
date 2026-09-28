/**
 * Static assertions on the container and CI definitions.
 *
 * These are checked as text because the test suite must be runnable on a
 * machine with no container engine, and because the posture of a Dockerfile is
 * just as much a review concern as its behaviour. Each assertion here encodes a
 * control that a reviewer would otherwise have to re-derive by eye, and that a
 * well-meaning refactor could quietly remove.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(ROOT, relative), 'utf8');

const dockerfile = await read('Dockerfile');
const compose = await read('docker-compose.yml');
const ci = await read('.github/workflows/ci.yml');

/** Strip full-line `#` comments so assertions target real directives. */
function directives(contents) {
  return contents
    .split('\n')
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .join('\n');
}

const dockerDirectives = directives(dockerfile);

describe('Dockerfile', () => {
  it('pins the base image to a specific tag', () => {
    const from = dockerDirectives.match(/^FROM\s+(\S+)/m);
    assert.ok(from, 'no FROM instruction');
    assert.match(from[1], /:\d+(\.\d+)*(-[a-z0-9.]+)?$/, `base image ${from[1]} is not pinned to a tag`);
    assert.doesNotMatch(from[1], /:latest$/);
  });

  it('does not run as root', () => {
    const user = dockerDirectives.match(/^USER\s+(\S+)/m);
    assert.ok(user, 'no USER instruction: the container would run as root');
    assert.notEqual(user[1], 'root');
  });

  it('never fetches a remote URL into the image', () => {
    // ADD with a URL pulls unverified content into the build and can be swapped
    // by anyone who can influence DNS or the upstream host.
    assert.doesNotMatch(dockerDirectives, /^ADD\s+http/i);
  });

  it('does not copy the whole build context', () => {
    assert.doesNotMatch(dockerDirectives, /^COPY\s+\.\s+\.\s*$/, 'a blanket COPY . . can bake .git into the image');
  });

  it('never runs package lifecycle scripts during install', () => {
    const install = dockerDirectives.match(/^RUN\s+npm\s+ci.*$/m);
    assert.ok(install, 'no npm ci in the image');
    assert.match(install[0], /--ignore-scripts/);
  });

  it('keeps npm scratch data on a writable path', () => {
    assert.match(dockerDirectives, /NPM_CONFIG_CACHE=\/tmp\//);
  });
});

describe('docker-compose.yml', () => {
  it('runs the service as a non-root, configurable user', () => {
    assert.match(compose, /^\s{4}user:\s+"/m);
  });

  it('uses a read-only root filesystem', () => {
    assert.match(compose, /^\s{4}read_only:\s*true\s*$/m);
  });

  it('drops all Linux capabilities and forbids privilege escalation', () => {
    assert.match(compose, /cap_drop:\s*\n\s+- ALL/);
    assert.match(compose, /no-new-privileges:true/);
  });

  it('has no network access at run time', () => {
    assert.match(compose, /network_mode:\s*none/);
  });

  it('publishes no host ports', () => {
    // The suite serves nothing. The previous definition mapped 8080 to a
    // container with no listener, which is pure attack surface.
    assert.doesNotMatch(compose, /^\s+ports:/m);
  });

  it('provides a writable tmpfs for the npm cache', () => {
    assert.match(compose, /tmpfs:\s*\n\s+- \/tmp:/);
  });
});

describe('continuous integration', () => {
  it('runs on every push and pull request', () => {
    assert.match(ci, /^on:/m);
    assert.match(ci, /pull_request:/);
    assert.match(ci, /push:/);
  });

  it('requests read-only repository permissions only', () => {
    assert.match(ci, /permissions:\s*\n\s+contents:\s*read/);
    assert.doesNotMatch(ci, /contents:\s*write/);
    assert.doesNotMatch(ci, /id-token:\s*write/);
  });

  it('pins third-party actions to exact released versions', () => {
    for (const match of ci.matchAll(/uses:\s*([^\s@]+)@(\S+)/g)) {
      assert.match(
        match[2],
        /^v\d+\.\d+\.\d+$/,
        `${match[1]} is pinned to "${match[2]}" rather than an exact release`,
      );
    }
  });

  it('installs from the lockfile without running lifecycle scripts', () => {
    assert.match(ci, /npm ci --ignore-scripts/);
  });

  it('gates on every check the README promises', () => {
    for (const step of ['npm run lint', 'npm run validate', 'npm run check:readme', 'npm test']) {
      assert.ok(ci.includes(step), `CI does not run \`${step}\``);
    }
  });

  it('fails the build on known high or critical vulnerabilities', () => {
    assert.match(ci, /npm audit --audit-level=high/);
  });

  it('bounds every job with a timeout', () => {
    // One timeout per job: `runs-on` and `timeout-minutes` are both mandatory
    // per job, so their counts must match.
    const runs = ci.match(/^\s+runs-on:\s*\S+/gm) ?? [];
    const timeouts = ci.match(/^\s+timeout-minutes:\s*\d+/gm) ?? [];
    assert.ok(runs.length >= 3, `expected at least three jobs, found ${runs.length}`);
    assert.equal(timeouts.length, runs.length, 'every job needs a timeout-minutes');
  });

  it('keeps dependency and container updates automated', async () => {
    const dependabot = await read('.github/dependabot.yml');
    for (const ecosystem of ['npm', 'github-actions', 'docker']) {
      assert.ok(dependabot.includes(`package-ecosystem: ${ecosystem}`), `no dependabot for ${ecosystem}`);
    }
  });
});

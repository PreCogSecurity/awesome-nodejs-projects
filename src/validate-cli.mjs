/**
 * `npm run validate` entry point.
 *
 * Exits non-zero and prints one greppable line per problem so that CI logs
 * point a contributor at the exact field that needs fixing.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config from '../lint.config.mjs';
import { formatFindings, loadCatalog } from './validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dataPath = path.join(ROOT, config.paths.data);

try {
  const { findings } = await loadCatalog(dataPath);
  if (findings.length > 0) {
    console.error(`validate: ${findings.length} problem(s) in ${config.paths.data}\n${formatFindings(findings)}`);
    process.exitCode = 1;
  } else {
    console.log(`validate: ${config.paths.data} is valid.`);
  }
} catch (error) {
  console.error(`validate: could not read ${config.paths.data}: ${error.message}`);
  process.exitCode = 1;
}

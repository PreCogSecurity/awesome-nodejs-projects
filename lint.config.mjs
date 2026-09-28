/**
 * Single source of truth for repository lint + validation rules.
 *
 * Kept as a real config module (rather than constants scattered through the
 * scripts) so that the rules enforced locally are identical to the rules
 * documented for contributors and asserted by CI.
 */

/**
 * Repository lint and validation rules.
 * Shared by `src/lint.mjs`, `src/validate.mjs` and the test suite.
 */
const config = {
  paths: {
    data: 'data/projects.json',
    schema: 'data/projects.schema.json',
    readme: 'README.md',
  },

  /** Files/directories never linted or scanned. */
  ignore: [
    '.git/**',
    '.github/workflows/*.local.yml',
    'node_modules/**',
    'coverage/**',
    '.terraform/**',
  ],

  style: {
    /**
     * Hard cap for source lines.
     */
    maxLineLength: 120,
    /**
     * Per-extension overrides. An awesome list is one entry per line, and a
     * data record is one object per line, so wrapping them would corrupt the
     * rendered output rather than improve it. The cap still catches runaway
     * lines, such as an accidentally pasted paragraph.
     */
    maxLineLengthByExtension: {
      '.json': 300,
      '.md': 300,
    },
    /** Every text artefact must end with exactly one trailing newline. */
    requireFinalNewline: true,
    /** No leading or trailing whitespace on any line. */
    forbidTrailingWhitespace: true,
    /** Spaces only, never tab indentation. */
    forbidTabs: true,
    /** Refuse to grow past 100 KiB per file. */
    maxFileBytes: 100 * 1024,
  },

  security: {
    /**
     * Links in a document that thousands of people click must not be
     * downgradable to plaintext by a network attacker. http:// is rejected.
     */
    requireHttps: true,
    /**
     * CONTRIBUTING requires a source repository link. Restricting the hosts
     * keeps entries pointing at real, auditable source rather than, for
     * example, a paste site or a look-alike domain.
     */
    allowedRepoHosts: ['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org'],
    /** Hostnames that may never appear in the curated data. */
    deniedHostPatterns: [/\.rawgit\.com$/i, /\.ngrok\.io$/i, /\.pastebin\.com$/i],
    /** Block control characters and right-to-left override tricks in text. */
    forbidControlCharacters: true,
    /** Descriptions must not restate the ecosystem they live in. */
    bannedDescriptionTerms: [/\bnode\.?js\b/i],
  },

  catalog: {
    schemaVersion: 1,
    /** Lowercase, dash-separated, e.g. `chat-bots`. */
    idPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    maxDescriptionLength: 300,
    maxNameLength: 80,
  },
};

export default config;

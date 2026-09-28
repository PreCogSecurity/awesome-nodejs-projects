# Contributing

Thanks for helping improve this list. Everything below is enforced by
`npm run verify`, so a pull request that does not pass will not merge.

## Adding a project

**Edit `data/projects.json`. Do not edit the list section of `README.md`.** It is generated;
`npm run verify` fails if the two disagree.

```jsonc
{
  "category": "cms",                                       // must be a category or child id
  "name": "Example CMS",                                   // the project's display name
  "repo": "https://github.com/example/example-cms",        // required, https only
  "website": "https://example.com/",                       // optional, https only
  "description": "A short description of the project."      // one sentence, full stop
}
```

Then:

```bash
npm run render   # regenerate the list section of README.md
npm run verify   # lint + validate + freshness + tests
```

Commit the data change and the regenerated `README.md` together - the generated list is part
of the change, not a separate chore.

## Rules a new entry must satisfy

These come from `lint.config.mjs` and are checked by `npm run validate`.

- The repository link is **required**, must be `https://`, and must point at
  GitHub, GitLab, Bitbucket or Codeberg.
- Every link must be `https://`. Plaintext links can be rewritten in transit.
- Each repository may appear **once**. Reuse of a repository is rejected, not silently merged.
- A description starts with a capital letter and ends with a full stop.
- A description must not restate `Node.js`; the ecosystem is already implied.
- No control characters, and no bidirectional overrides. These are used to
  disguise text in rendered Markdown.
- A description must not embed credentials inside a URL.
- New entries go at the **bottom** of their category. Requesting a new category is
  welcome; new categorisations of existing entries are welcome too.

## House style for descriptions

- Keep them short and simple, but descriptive.
- Start with a capital and end with a full stop.
- Spell out the technology accurately (`JavaScript`, `MongoDB`, `Express`).
- Check spelling and grammar. CI will not do this for you.

## Checks that must pass

| Check | Command | Fails when |
| --- | --- | --- |
| Lint | `npm run lint` | Trailing whitespace, CRLF, tabs, missing final newline, lines over 120 characters, invalid JSON. |
| Data validation | `npm run validate` | Any rule above is broken. |
| Generated-doc freshness | `npm run check:readme` | `README.md` was not regenerated after a data change. |
| Tests | `npm test` | A validator or renderer behaviour regressed, or the real catalog became invalid. |
| Dependencies | `npm run audit` | A known high or critical vulnerability. |
| Container | `docker compose run --rm verify` | The rootless read-only image cannot run the suite. |

The same suite runs on every push and pull request in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Pull request guidelines

- Search previous suggestions before making a new one, as yours may be a duplicate.
- Make an individual pull request for each suggestion.
- The pull request should have a useful title and explain why the project should be
  included.
- Please open a pull request to remove unmaintained projects from this list.
- Do not reformat, reorder or reword unrelated entries in the same pull request.
  A large mixed diff hides the change a reviewer needs to approve.

## Requirements

Node.js 20.11 or newer (`.nvmrc` pins the version CI uses). There are no
dependencies to install: `npm ci` is effectively a no-op and works offline.

### Updating your pull request

If maintainers ask for changes, edit the branch and push again rather than force-pushing
over shared history. A guide to the different options is in
[amending a commit](https://github.com/RichardLitt/docs/blob/master/amending-a-commit-guide.md).

## Security

Do not report vulnerabilities in a public issue. See [SECURITY.md](SECURITY.md).

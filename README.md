# Awesome Node.js projects [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated list of awesome open-source applications made with Node.js. See
> [Awesome Node.js](https://github.com/sindresorhus/awesome-nodejs) for a curated list of
> packages and resources.

> [Read the story of how this repository ranked first on Hacker News and reached the
> 1000+ stars on GitHub.](https://medium.com/@vdeturckheim/the-story-of-how-i-got-first-place-on-hacker-news-and-got-1000-stars-on-github-9dc9e63ef829)

## How this list is maintained

The list is **not** hand-edited in this file. Every entry lives in
[`data/projects.json`](data/projects.json) and `README.md` is regenerated from it, so:

- a pull request shows exactly which entries changed, and
- every entry passes schema, URL-safety and content rules *before* it is rendered.

That matters for security as well as tidiness. A list is a pile of links that a large
audience clicks. Plaintext `http://` links, look-alike hostnames and malformed entries are
all rejected automatically rather than relying on a reviewer to notice them.

## Requirements

- Node.js 20.11 or newer (see [`.nvmrc`](.nvmrc)). There is nothing to build and **no
  third-party dependency to install** - the tooling uses only the Node.js standard library,
  so `npm ci` is instant and the supply-chain surface is empty by design.

## Verify a fresh clone

```bash
git clone https://github.com/PreCogSecurity/awesome-nodejs-projects.git
cd awesome-nodejs-projects
npm ci          # no dependencies, but keeps the install reproducible
npm run verify  # lint + validate + readme freshness + tests
```

| Command             | What it does                                                            |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run lint`      | Style checks over all tracked text files.                                |
| `npm run validate`  | Schema, URL-safety and content rules over `data/projects.json`.          |
| `npm run check:readme` | Fails if `README.md` has drifted from `data/projects.json`.           |
| `npm run render`    | Regenerates the list section of `README.md`.                             |
| `npm test`          | Unit tests for the validator and renderer, plus tests over the real data. |
| `npm run audit`     | `npm audit --audit-level=high`.                                          |
| `npm run verify`    | Everything CI runs, in one command.                                      |

## Running the checks in a container

A hardened, rootless image is provided for environments without a local Node.js install:

```bash
cp .env.example .env     # optional; every value has a working default
docker compose run --rm verify
```

The compose service is the same `npm run verify` run with a read-only root filesystem, all
Linux capabilities dropped and a non-root user, so a malicious entry in this repository
cannot escape into the host.

## Contributing

New entries are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the entry format, the
rules the validator enforces, and the checks your pull request has to pass. Security issues
should follow [SECURITY.md](SECURITY.md) instead.

<!-- BEGIN GENERATED LIST: edit data/projects.json, then run `npm run render` -->

## CMS

* [Keystone](https://github.com/keystonejs/keystone) ([website](https://keystonejs.com/)) - The open source framework for developing database-driven websites, applications and APIs. Built on Express and MongoDB.
* [Pencilblue](https://github.com/pencilblue/pencilblue) ([website](https://pencilblue.org/)) - Business class content management.
* [Apostrophe](https://github.com/punkave/apostrophe) ([website](https://apostrophecms.org/)) - A CMS framework that supports in-context editing, schema-driven content types, flexible widgets, and much more.
* [Cody](https://github.com/jcoppieters/cody/) ([website](https://howest.cody-cms.org/en/)) - JavaScript content management system.
* [HashBrown](https://github.com/putaitu/hashbrown-cms/) ([website](https://hashbrown.rocks/)) - Remote, multilingual, multi-project, multi-environment CMS using customisable content and field schemas.
* [Strapi](https://github.com/strapi/strapi) ([website](https://strapi.io/)) - An open source ecosystem to build, deploy and manage your own API.
* [Enduro.js](https://github.com/gottwik/enduro) ([website](https://endurojs.com/)) - Minimalistic, flat-file, full-fledged CMS that gets your website running in minutes.

## Developers

* [Shield](https://github.com/badges/shields) ([website](https://shields.io/)) - Shields badge specification, website and default API server.
* [David-www](https://github.com/alanshaw/david-www) ([website](https://david-dm.org/)) - David helps keep your project dependencies up to date.
* [JSON-server](https://github.com/typicode/json-server) - Get a full fake REST API with zero coding in less than 30 seconds (seriously).
* [Wordpress rest-api-console2](https://github.com/Automattic/rest-api-console2) ([website](https://developer.wordpress.com/docs/api/console/)) - WordPress.com REST API developer console.
* [Mongo-Express](https://github.com/mongo-express/mongo-express) - Web-based MongoDB admin interface, written with Express.
* [Eve](https://github.com/witheve/eve) ([website](https://witheve.com/)) - Eve is a set of tools to help us think. Currently, these tools include: a temporal query language, a compiler, and a database.
* [Hotel](https://github.com/typicode/hotel) - Start your dev servers from your browser and get local domains in seconds.
* [Hackathon Starter](https://github.com/sahat/hackathon-starter) - A boilerplate for web applications.
* [Node-RED](https://github.com/node-red/node-red) - A visual tool for wiring the Internet of Things.
* [nscm](https://github.com/nodesource/nscm) - An open-source CLI tool for working with NodeSource Certified Modules.

**Electron apps**

* [Atom](https://github.com/atom/atom) ([website](https://atom.io/)) - Fully hackable text editor using Chrome.
* [Visual Studio Code](https://github.com/microsoft/vscode) ([website](https://code.visualstudio.com/)) - An Electron based text editor created by Microsoft.

## Forms

* [TellForm](https://github.com/whitef0x0/tellform) ([website](https://tellform.com/)) - A beautiful and powerful self-hostable form and survey builder similar to Typeform or Google Forms.

## Blogs

* [Ghost](https://github.com/TryGhost/Ghost) ([website](https://ghost.org/)) - A simple, powerful publishing platform.
* [Mean-Blog](https://github.com/DimitriMikadze/Mean-Blog) - Blog using ExpressJS, AngularJS and MongoDB. MEAN JavaScript full-stack application.
* [Wordpress Calypso](https://github.com/Automattic/wp-calypso) ([website](https://developer.wordpress.com/calypso/)) - The new JavaScript- and API-powered WordPress.com.
* [Hexo](https://github.com/hexojs/hexo) ([website](https://hexo.io/)) - A fast, simple and powerful blog framework.
* [Reptar](https://github.com/reptar/reptar) ([website](https://reptar.github.io/)) - Powerful, modern, and flexible static site generator.

## Lifestyle

* [Cozy](https://github.com/cozy/simple-cozy) ([website](https://cozy.io/)) - Personal cloud: own, synchronize and connect your data.
* [Mediacenterjs](https://github.com/jansmolders86/mediacenterjs) ([website](https://mediacenterjs.com/)) - An HTML/CSS/JavaScript based media center.
* [Habitica](https://github.com/HabitRPG/habitica) ([website](https://habitica.com/static/front/)) - A habit tracker app which treats your goals like a role playing game.
* [moeda](https://github.com/thompsonemerson/moeda) - Foreign exchange rates and currency conversion from the command line.

## Business

* [TimeOff Management](https://github.com/timeoff-management/application) ([website](https://timeoff.management/)) - Simple yet powerful absence management software for small and medium size business.
* [Gadael](https://github.com/gadael/gadael) ([website](https://www.gadael.org/)) - Leave management software with French work regulations support.
* [Basic Hospital Information Management Application](https://github.com/IMA-WorldHealth/bhima-2.X) ([website](https://bhi.ma/)) - Hospital management suite for the developing world.

## Science

* [NASA's Open MCT](https://github.com/nasa/openmct) ([website](https://nasa.github.io/openmct/)) - A web based mission control framework.

## E-commerce

**Meteor apps**

* [Reaction Commerce](https://github.com/reactioncommerce/reaction) ([website](https://reactioncommerce.com/)) - A modern reactive, real-time event-driven ecommerce platform.

## Chat Bots

* [PokéDex Go Messenger Bot](https://github.com/zwacky/pokedex-go) ([website](https://www.facebook.com/PokedexGo/)) - A Pokédex messenger bot for Pokémon Go to easily find Pokémon and their strengths and weaknesses.

<!-- END GENERATED LIST -->

## License

The tooling in this repository (everything under `src/` and `test/`, the CI configuration
and the container definitions) is licensed under the [MIT License](LICENSE).

The curated list content is dedicated to the public domain under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), matching the
convention for awesome lists.

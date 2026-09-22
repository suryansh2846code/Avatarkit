# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [semantic versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0 — 2026-09-22

The package is now published to npm as **`avatarkit`**. It was previously
installable only from git, because the name `character` was already taken.

### Breaking

Everything here is a rename. No behaviour changed, and nothing was removed.

| Before | After |
| --- | --- |
| package `character` (git only) | package [`avatarkit`](https://www.npmjs.com/package/avatarkit) on npm |
| `createCharacter(...)` | `createAvatar(...)` |
| browser global `Character` | browser global `Avatarkit` |
| `dist/character.global.js` | `dist/avatarkit.global.js` |
| schema id `character.scene` | schema id `avatarkit.scene` |
| `localStorage` key `character.presets` | `avatarkit.presets` |

**Saved documents and shared links keep working.** A document carrying the old
`character.scene` id is re-stamped by `migrate()`, which `normalize()` runs —
and `normalize()` is what `createAvatar`, `renderToString`, `decode` and
`fromURL` all call, so there is no door it can arrive through unmigrated. It
comes back whole: same parts, same palette, same rendered output. The old id is exported as `LEGACY_SCHEMA_ID` for
hosts that want to rewrite their own stored rows. Nothing ever writes it.

Saved editor presets are the one thing that does not carry over, because they
live under a `localStorage` key that also changed. Hosts that set `storageKey`
themselves are unaffected.

To upgrade, rename the two call sites:

```diff
-import { createCharacter, generateScene } from "character";
-createCharacter("#a", generateScene(user.email));
+import { createAvatar, generateScene } from "avatarkit";
+createAvatar("#a", generateScene(user.email));
```

### Added

- **TypeScript declarations**, hand-written to match `src/` and checked under
  `strict`: `types/index.d.ts` and `types/editor.d.ts`. No `@types/` package
  and no build step — the source stays plain JavaScript.
- `LEGACY_SCHEMA_ID`, and migration of pre-rename documents.
- Two tests covering that migration, one for a document and one for a shared
  link. 47 tests in total.
- `unpkg` and `jsdelivr` entry points, so a `<script>` tag from a CDN works
  without cloning anything.
- `prepublishOnly` rebuilds the bundle and runs the suite, so a published
  version cannot carry a stale `dist/`.

## 0.1.0

First release. Convex-primitive renderer, document format, deterministic
generation from a seed, follow-the-cursor loop, editor, SVG and PNG export.

# Contributing

## Setup

```bash
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
pnpm install --frozen-lockfile
git clone https://github.com/HajiLight/hide-selected-friends.git src/userplugins/hideSelectedFriends
pnpm build        # or: cd src/userplugins/hideSelectedFriends && node scripts/dev.mjs --build
pnpm check        # typecheck + vitest
```

Node.js 22+ and pnpm are required. `dev.mjs` can also use `$VENCORD_DIR`, `./.vencord`, `../Vencord`, or `../vencord/Vencord` if you keep the checkout elsewhere.

## Layout

| File | Responsibility |
| --- | --- |
| [`logic.ts`](logic.ts) | Pure functions only (no Vencord imports or globals) |
| [`index.ts`](index.ts) | Plugin settings, Webpack patches, and lifecycle wiring |
| [`tests/`](tests) | Vitest suites covering `logic.ts` and `index.ts` (100% line coverage locally; CI does not enforce a threshold) |

## Patch guidelines

- Match on minimal, stable anchors using Vencord `\i` placeholders instead of minified names.
- Never match on CSS class names, translated strings, or A/B-tested UI text.
- Keep injected expressions valid JS and preserve reference identity in React store getters when nothing changes.
- Include `GLOBAL_ENV.BUILD_NUMBER` (from `Ctrl+Shift+I`) on patch-related PRs or issues.

## Commits & License

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) and ensure `pnpm check` passes.
- Contributions are licensed under [GPL-3.0-or-later](LICENSE), matching Vencord.

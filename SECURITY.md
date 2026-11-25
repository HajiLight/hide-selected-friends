# Security policy

## Scope

`HideSelectedFriends` is a local Vencord userplugin that filters UI rendering only (`Online` friends tab and `Active Now` panel). The plugin makes no network requests and collects no telemetry; entered IDs live in Vencord's local settings (`%AppData%\Vencord\settings\settings.json` on Windows). Caveat: if you enable Vencord Cloud's settings sync, that settings object (including these IDs) is uploaded to Vencord's service. Issues in Discord, Vencord, or Vesktop themselves are out of scope.

## Reporting a vulnerability

Use **Security → Report a vulnerability** (private advisory). If that is unavailable, open an issue without exposing private user IDs, and include:

- Plugin version (`package.json`), Vencord commit, client (`Stable`/`Canary`/`PTB`/`Vesktop`), and `GLOBAL_ENV.BUILD_NUMBER`
- Settings state (`hideInOnlineTab`, `hideInActiveNow`) and clear reproduction steps

## In scope vs. out of scope

**In scope:**
- Any unintended network request, telemetry, or exfiltration of local settings/IDs
- Any mutation of Discord relationships or account state
- Unhandled crashes or infinite loops caused by malformed inputs/cards
- Filtering remaining active when `settings.store.enabled === false` or the surface toggle is off

**Out of scope:**
- Hidden friends appearing on **unfiltered surfaces** documented in [`README.md`](README.md) (DMs, `All`/`Pending`/`Blocked` tabs, voice channels, server member lists, `Ctrl+K`, `@` autocomplete, overlay, or Flux stores)
- Hidden friends seeing your presence/activity or appearing on other devices
- Upstream Discord updates breaking a webpack patch (file a regular bug report instead)
- General Discord Terms of Service risk from client modifications

## Supported versions

1.x — the latest [release](https://github.com/HajiLight/hide-selected-friends/releases) and the latest commit on `main`. Older releases do not receive fixes.

# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-11-25

First public release. Tested with Discord Stable `1.0.9269` and Vencord `1.15.19`.

### Added

- Hide selected friends from the **Online** tab of the friends list. Filtering happens before rows
  render, so the list, search and the `Online — N` badge stay consistent.
- Hide selected friends' cards from the **Active Now** panel; group cards disappear as a whole.
- Two independent settings, `hideInOnlineTab` and `hideInActiveNow`, both enabled by default.
- `hiddenUsers` accepts 15–20 digit user IDs or `<@id>` / `<@!id>` mentions, separated by new
  lines, spaces, commas or semicolons.
- Settings changes apply on the next render without a tab switch; Active Now updates when its store
  next emits.

### Safety

- Local rendering only: nothing is blocked, modified on Discord's servers, or sent over the
  network. You remain friends with every hidden user.
- Users are matched by ID only; names are ignored because they change and would fail silently.
- Empty or malformed entries are ignored rather than guessed.
- Hidden users remain visible on surfaces this plugin does not patch: DM sidebar, All/Pending tabs,
  voice channels, member lists, mentions, the overlay and other devices.

### Notes

- Vencord applies patches at startup, so enabling the plugin for the first time requires restarting
  Discord; toggling the settings afterwards is immediate.
- Hiding is a local display preference: other people and other devices see no change.
- If Vencord Cloud settings sync is enabled, the settings object (including `hiddenUsers`) is
  uploaded to Vencord's service; the plugin itself makes no network requests.

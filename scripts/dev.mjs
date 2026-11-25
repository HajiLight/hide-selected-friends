#!/usr/bin/env node
/*
 * HideSelectedFriends — dev helper: copies the plugin into a Vencord checkout and builds it.
 * Copyright (C) 2026 HajiLight
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 *   node scripts/dev.mjs            copy the sources into Vencord
 *   node scripts/dev.mjs --build    copy, run Vencord's build, verify dist/
 *
 * Checkout lookup order: $VENCORD_DIR, ./.vencord, ../Vencord, ../vencord/Vencord.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = "hideSelectedFriends";
const SOURCES = ["index.ts", "logic.ts"];
const shouldBuild = process.argv.includes("--build");

function fail(message) {
    console.error(`\n  ✗ ${message}\n`);
    process.exit(1);
}

function findVencord() {
    const candidates = [
        process.env.VENCORD_DIR,
        join(repo, ".vencord"),
        join(repo, "..", "Vencord"),
        join(repo, "..", "vencord", "Vencord")
    ].filter(Boolean);

    for (const candidate of candidates) {
        const dir = resolve(candidate);
        // Vencord gitignores `src/userplugins` and does not ship it, so requiring it would reject
        // every fresh clone. Recognise a checkout by its manifest and its source directory.
        if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "src", "Vencord.ts"))) return dir;
    }

    fail(`No Vencord checkout found. Tried:\n${candidates.map(c => `      ${c}`).join("\n")}\n    Set VENCORD_DIR or clone Vencord to ./.vencord`);
}

const vencord = findVencord();
const userplugins = join(vencord, "src", "userplugins");
// A fresh clone has no such directory; create it before wiping/copying into it.
mkdirSync(userplugins, { recursive: true });
const target = join(userplugins, PLUGIN);

// Wipe the target first: a stale file left behind from an older version is worse than no file.
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

for (const file of SOURCES) {
    copyFileSync(join(repo, file), join(target, file));
}

console.log(`  → ${target}`);

if (!shouldBuild) {
    console.log("  Restart Discord to load it, or run `pnpm build` for a full rebuild.\n");
    process.exit(0);
}

console.log(`  → pnpm build in ${vencord}\n`);
const build = spawnSync("pnpm", ["build"], {
    cwd: vencord,
    stdio: "inherit",
    shell: process.platform === "win32"
});

if (build.status !== 0) fail("Vencord build failed");

const renderer = join(vencord, "dist", "renderer.js");
const sourcemap = join(vencord, "dist", "renderer.js.map");

if (!existsSync(renderer)) fail(`Build produced no ${renderer}`);

const bundle = readFileSync(renderer, "utf8");
const map = existsSync(sourcemap) ? readFileSync(sourcemap, "utf8") : "";

if (!bundle.includes("HideSelectedFriends")) fail("The plugin is not in dist/renderer.js — check the build log above");
if (map && !map.includes(`userplugins/${PLUGIN}/index.ts`)) fail(`dist/renderer.js.map does not reference userplugins/${PLUGIN}/index.ts`);

console.log(`\n  ✓ ${PLUGIN} is in dist/renderer.js (${(bundle.length / 1024).toFixed(0)} kB)`);
console.log("  Quit Discord completely (tray included) and start it again.\n");

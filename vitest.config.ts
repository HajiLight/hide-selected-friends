import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        environment: "node",
        coverage: {
            provider: "v8",
            include: ["index.ts", "logic.ts"],
            reporter: ["text", "json", "json-summary"]
        }
    },
    resolve: {
        alias: {
            "@api/Settings": path.resolve(import.meta.dirname, "tests/mocks/Settings.ts"),
            "@utils/types": path.resolve(import.meta.dirname, "tests/mocks/types.ts"),
            "@webpack/common": path.resolve(import.meta.dirname, "tests/mocks/common.ts")
        }
    }
});

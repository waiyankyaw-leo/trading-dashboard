import baseConfig from "@tradedash/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
    ...baseConfig,
    {
        rules: {
            // Allow console.log in server.ts for startup messages
            "no-console": ["warn", { allow: ["log", "warn", "error"] }],
        },
    },
];

import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      ecmaVersion: 2020,
      globals: {
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      prettier: prettier,
      import: importPlugin,
    },
    rules: {
      ...ts.configs.recommended.rules,
      "import/first": "error",
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_$" }],
      "@typescript-eslint/no-explicit-any": "warn",

      // Boundary rules to prevent cross-imports between v1 and v2 packages
      // Prevent importing from v1 core package directly
      // The extensions package (@x402x/extensions) should only use
      // @x402/core v2 types, not @x402/core v1 internals
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../core/**"],
              message:
                "Import from v1 core package is not allowed in extensions package. Use @x402/core v2 types only.",
            },
          ],
        },
      ],

      // Ensure proper import ordering to catch boundary issues early
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },
];

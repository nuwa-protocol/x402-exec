import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  dts: false, // Temporarily disable DTS generation
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["@x402x/core_v2", "express"],
});

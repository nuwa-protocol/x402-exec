import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true, // Re-enable to identify and fix type issues
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});

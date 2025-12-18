import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  dts: false, // Temporarily disable DTS generation to avoid type errors
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});

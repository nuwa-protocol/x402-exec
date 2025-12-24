import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  dts: false, // Workspace package - types provided by consuming packages
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});

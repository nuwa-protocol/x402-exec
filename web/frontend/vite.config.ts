import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import mdx from "@mdx-js/rollup";
import path from "node:path";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
    mdx({
            remarkPlugins: [
                remarkFrontmatter,
                remarkGfm,
                [remarkMdxFrontmatter, { name: "frontmatter" }],
            ],
            // NOTE: We render code fences with our own CodeBlock (Shiki-based) in MDXProvider.
            // Using rehype-starry-night here would pre-highlight and bypass our custom renderer,
            // so we disable it to ensure headers + copy button render consistently.
            // rehypePlugins: [rehypeStarryNight],
        }),
		react(),
		tailwindcss(),
	],
	resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

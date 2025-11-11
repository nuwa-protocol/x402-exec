import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import mdx from "@mdx-js/rollup";
import rehypeStarryNight from "rehype-starry-night";
import path from "node:path";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		mdx({
			remarkPlugins: [
				remarkFrontmatter,
				[remarkMdxFrontmatter, { name: "frontmatter" }],
			],
			rehypePlugins: [rehypeStarryNight],
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

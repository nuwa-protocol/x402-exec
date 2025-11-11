declare module "*.mdx" {
	import type { ComponentType } from "react";
	import type { DocFrontmatter } from "./docs";

	const MDXComponent: ComponentType<Record<string, unknown>>;
	export const frontmatter: DocFrontmatter | undefined;
	export default MDXComponent;
}

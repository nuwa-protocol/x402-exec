import type { ComponentType } from "react";
import type { DocFrontmatter } from "@/types/docs";

type DocModule = {
	default: ComponentType<Record<string, unknown>>;
	frontmatter?: DocFrontmatter;
};

const docModules = import.meta.glob("../content/docs/**/*.mdx", {
	eager: true,
}) as Record<string, DocModule>;

export type LoadedDoc = {
	slug: string;
	filePath: string;
	Component: ComponentType<Record<string, unknown>>;
	frontmatter: DocFrontmatter & { slug: string };
};

const docs: LoadedDoc[] = Object.entries(docModules)
	.map(([path, mod]) => {
		if (!mod?.default) {
			return null;
		}

		const slug = sanitizeSlug(mod.frontmatter?.slug ?? pathToSlug(path));

		const frontmatter: DocFrontmatter & { slug: string } = {
			title: mod.frontmatter?.title ?? slugToTitle(slug),
			description: mod.frontmatter?.description,
			navGroup: mod.frontmatter?.navGroup,
			navTitle: mod.frontmatter?.navTitle,
			navOrder: mod.frontmatter?.navOrder,
			status: mod.frontmatter?.status,
			hideFromSidebar: mod.frontmatter?.hideFromSidebar,
			slug,
		};

		return {
			filePath: path,
			slug,
			Component: mod.default,
			frontmatter,
		};
	})
	.filter((doc): doc is LoadedDoc => Boolean(doc?.frontmatter?.title))
	.sort((a, b) => {
		const orderA = a.frontmatter.navOrder ?? Number.MAX_SAFE_INTEGER;
		const orderB = b.frontmatter.navOrder ?? Number.MAX_SAFE_INTEGER;
		if (orderA !== orderB) {
			return orderA - orderB;
		}
		return a.frontmatter.title.localeCompare(b.frontmatter.title);
	});

const docsBySlug = new Map(docs.map((doc) => [doc.slug, doc]));
const defaultDocSlug = docs[0]?.slug;

export type SidebarGroup = {
	title: string;
	items: Array<
		Pick<LoadedDoc, "slug"> & {
			label: string;
			status?: DocFrontmatter["status"];
		}
	>;
	order: number;
};

const sidebarGroups: SidebarGroup[] = (() => {
	const groupMap = new Map<string, SidebarGroup>();

	for (const doc of docs) {
		if (doc.frontmatter.hideFromSidebar) continue;

		const group = doc.frontmatter.navGroup ?? "General";

		if (!groupMap.has(group)) {
			groupMap.set(group, {
				title: group,
				order: doc.frontmatter.navOrder ?? Number.MAX_SAFE_INTEGER,
				items: [],
			});
		}

		const sidebarGroup = groupMap.get(group);

		if (sidebarGroup) {
			sidebarGroup.items.push({
				slug: doc.slug,
				label: doc.frontmatter.navTitle ?? doc.frontmatter.title,
				status: doc.frontmatter.status,
			});
			sidebarGroup.order = Math.min(
				sidebarGroup.order,
				doc.frontmatter.navOrder ?? Number.MAX_SAFE_INTEGER,
			);
		}
	}

	return Array.from(groupMap.values())
		.map((group) => ({
			...group,
			items: group.items.sort((a, b) => {
				const docA = docsBySlug.get(a.slug);
				const docB = docsBySlug.get(b.slug);
				const orderA = docA?.frontmatter.navOrder ?? Number.MAX_SAFE_INTEGER;
				const orderB = docB?.frontmatter.navOrder ?? Number.MAX_SAFE_INTEGER;
				if (orderA !== orderB) {
					return orderA - orderB;
				}
				return a.label.localeCompare(b.label);
			}),
		}))
		.sort((a, b) => {
			if (a.order !== b.order) {
				return a.order - b.order;
			}
			return a.title.localeCompare(b.title);
		});
})();

export function getDocBySlug(slug?: string) {
	if (!slug) {
		return defaultDocSlug ? docsBySlug.get(defaultDocSlug) : undefined;
	}

	return docsBySlug.get(sanitizeSlug(slug));
}

export function getSidebarGroups() {
	return sidebarGroups;
}

export function getAllDocs() {
	return docs;
}

export function getDefaultDocSlug() {
	return defaultDocSlug;
}

function pathToSlug(path: string) {
	return path
		.replace("../content/docs/", "")
		.replace(/\.mdx?$/, "")
		.replace(/index$/i, "index")
		.split("/")
		.filter(Boolean)
		.join("-");
}

function slugToTitle(slug: string) {
	return slug
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function sanitizeSlug(value: string) {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\-]/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug.length > 0 ? slug : "index";
}

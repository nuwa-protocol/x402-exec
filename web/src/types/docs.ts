export type DocFrontmatter = {
	title: string;
	description?: string;
	slug?: string;
	navGroup?: string;
	navTitle?: string;
	navOrder?: number;
	status?: "alpha" | "beta" | "stable";
	hideFromSidebar?: boolean;
};

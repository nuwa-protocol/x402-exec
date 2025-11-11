import { getAllDocs, getDefaultDocSlug, getSidebarGroups } from "@/lib/docs";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";

type DocsSidebarProps = {
	activeSlug?: string;
};

export function DocsSidebar({ activeSlug }: DocsSidebarProps) {
	const groups = getSidebarGroups();
	const defaultSlug = getDefaultDocSlug();

	if (!groups.length) {
		return null;
	}

	return (
		<aside className="hidden w-64 shrink-0 lg:block">
			<div className="sticky top-28 space-y-6">
				<nav className="space-y-6 text-sm">
					{groups.map((group) => (
						<div key={group.title} className="space-y-3">
							<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								{group.title}
							</p>
							<ul className="space-y-1.5">
								{group.items.map((item) => {
									const href =
										item.slug === defaultSlug ? "/docs" : `/docs/${item.slug}`;
									const isActive = activeSlug === item.slug;

									return (
										<li key={item.slug}>
											<Link
												to={href}
												className={cn(
													"flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
													"hover:bg-muted/70",
													isActive
														? "bg-muted font-medium text-foreground"
														: "text-muted-foreground",
												)}
											>
												<span>{item.label}</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</div>
					))}
				</nav>
			</div>
		</aside>
	);
}

export function DocsMobileNav({ activeSlug }: DocsSidebarProps) {
	const navigate = useNavigate();
	const docs = getAllDocs();
	const defaultSlug = getDefaultDocSlug();

	if (!docs.length) {
		return null;
	}

	return (
		<div className="lg:hidden">
			<select
				className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
				value={activeSlug ?? defaultSlug}
				onChange={(event) => {
					const nextSlug = event.target.value;
					navigate(nextSlug === defaultSlug ? "/docs" : `/docs/${nextSlug}`);
				}}
			>
				{docs.map((doc) => (
					<option key={doc.slug} value={doc.slug}>
						{doc.frontmatter.title}
					</option>
				))}
			</select>
		</div>
	);
}

import { MDXProvider } from "@mdx-js/react";
import { useEffect } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Link, useParams } from "react-router-dom";
import { DocsMobileNav, DocsSidebar } from "@/components/docs/sidebar";
import { Separator } from "@/components/ui/separator";
import { getDocBySlug, getDefaultDocSlug } from "@/lib/docs";

const mdxComponents = {
	h2: (props: ComponentPropsWithoutRef<"h2">) => (
		<h2 className="text-2xl font-semibold tracking-tight text-foreground" {...props} />
	),
	h3: (props: ComponentPropsWithoutRef<"h3">) => (
		<h3 className="text-xl font-semibold tracking-tight text-foreground" {...props} />
	),
	p: (props: ComponentPropsWithoutRef<"p">) => (
		<p className="text-base leading-relaxed text-muted-foreground" {...props} />
	),
	a: (props: ComponentPropsWithoutRef<"a">) => (
		<a
			className="font-medium text-primary underline-offset-4 hover:underline"
			target={props.href?.startsWith("http") ? "_blank" : undefined}
			rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
			{...props}
		/>
	),
	ul: (props: ComponentPropsWithoutRef<"ul">) => (
		<ul className="list-disc pl-6 text-muted-foreground" {...props} />
	),
	ol: (props: ComponentPropsWithoutRef<"ol">) => (
		<ol className="list-decimal pl-6 text-muted-foreground" {...props} />
	),
	li: (props: ComponentPropsWithoutRef<"li">) => <li className="mb-1" {...props} />,
	pre: (props: ComponentPropsWithoutRef<"pre">) => (
		<pre
			className="overflow-x-auto rounded-lg bg-muted px-4 py-3 text-sm text-foreground"
			{...props}
		/>
	),
	code: (props: ComponentPropsWithoutRef<"code">) => (
		<code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props} />
	),
	blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
		<blockquote
			className="border-l-2 border-primary/40 bg-muted/40 px-4 py-2 text-muted-foreground"
			{...props}
		/>
	),
	hr: () => <Separator className="my-8" />,
};

export default function DocsPage() {
	const { slug } = useParams();
	const doc = getDocBySlug(slug);

	useEffect(() => {
		if (doc?.frontmatter.title) {
			document.title = `x402x • ${doc.frontmatter.title}`;
		}
	}, [doc?.frontmatter.title]);

	if (!doc) {
		return <DocNotFound />;
	}

	const Article = doc.Component;

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 lg:flex-row lg:gap-12">
			<DocsSidebar activeSlug={doc.slug} />
			<section className="flex-1">
				<div className="space-y-6">
					<DocsMobileNav activeSlug={doc.slug} />
					<header className="space-y-2">
						<div>
							<h1 className="text-3xl font-bold tracking-tight">
								{doc.frontmatter.title}
							</h1>
							{doc.frontmatter.description ? (
								<p className="text-lg text-muted-foreground">
									{doc.frontmatter.description}
								</p>
							) : null}
						</div>
					</header>
					<Separator />
					<div className="docs-content space-y-6">
						<MDXProvider components={mdxComponents}>
							<Article />
						</MDXProvider>
					</div>
				</div>
			</section>
		</div>
	);
}

function DocNotFound() {
	const defaultSlug = getDefaultDocSlug();

	return (
		<div className="mx-auto max-w-2xl px-4 py-16 text-center">
			<h1 className="text-3xl font-semibold">Doc not found</h1>
			<p className="mt-3 text-muted-foreground">
				The page you requested does not exist. Please choose another guide from the sidebar.
			</p>
			{defaultSlug ? (
				<Link
					to="/docs"
					className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
				>
					Back to docs
				</Link>
			) : null}
		</div>
	);
}

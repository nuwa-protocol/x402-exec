import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ECOSYSTEM_TAG_LABEL,
  ECOSYSTEM_TAGS,
  type EcosystemTagId,
} from "@/constants/ecosystem/tags";
import {
  SUPPORTED_NETWORKS,
  SUPPORTED_PAYMENT_TOKENS,
} from "@/constants/facilitator";
import type {
  EcosystemProject,
  EcosystemProjectMetadata,
} from "@/types/ecosystem";
import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import * as React from "react";

const NETWORK_MAP = Object.fromEntries(
  SUPPORTED_NETWORKS.map((network) => [network.network, network]),
);

export default function EcosystemPage() {
  const [selectedTag, setSelectedTag] = React.useState<"all" | EcosystemTagId>(
    "all",
  );

  const filteredProjects =
    selectedTag === "all"
      ? ECOSYSTEM_PROJECTS
      : ECOSYSTEM_PROJECTS.filter((p) => p.tag === selectedTag);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Ecosystem
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          x402x Ecosystem Projects
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Discover teams and products that use x402x to ship AI, DeFi and much
          more
        </p>
      </div>

      <Tabs
        className="mb-6 w-full"
        value={selectedTag}
        onValueChange={(value) =>
          setSelectedTag(value as "all" | EcosystemTagId)
        }
      >
        <TabsList className="flex w-full flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="all" className="px-3 py-1.5 text-xs sm:text-sm">
            All
          </TabsTrigger>
          {ECOSYSTEM_TAGS.map((tag) => (
            <TabsTrigger
              key={tag.id}
              value={tag.id}
              className="px-3 py-1.5 text-xs sm:text-sm"
            >
              {tag.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <LazyMotion features={domAnimation} strict>
        <m.div layout className="grid gap-6 lg:grid-cols-2">
          <AnimatePresence>
            {filteredProjects.map((project) => (
              <m.div
                key={project.slug}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ProjectCard project={project} />
              </m.div>
            ))}
          </AnimatePresence>
        </m.div>
      </LazyMotion>
    </div>
  );
}

type ProjectCardProps = {
  project: EcosystemProject;
};

function ProjectCard({ project }: ProjectCardProps) {
  // Compact layout with illustration and a single Visit button

  // Build per-network badge text: "Network (Token, Token)"
  const networkBadges = project.networks.map((networkKey) => {
    const network = NETWORK_MAP[networkKey];
    const available = SUPPORTED_PAYMENT_TOKENS[networkKey] ?? [];
    const symbols = project.paymentTokensByNetwork[networkKey] ?? [];
    const tokenNames = symbols.map((symbol) => {
      const t = available.find((x) => x.symbol === symbol);
      return t?.label ?? symbol;
    });
    return {
      key: `${project.slug}-${networkKey}`,
      label: `${network?.name ?? networkKey} (${tokenNames.join(", ") || "No tokens"})`,
    };
  });

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative -mt-6 h-40 w-full overflow-hidden bg-muted">
        <img
          src={project.illustrationSrc}
          alt={`${project.name} illustration`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <CardHeader className="sr-only">{project.name}</CardHeader>
      <CardContent className="flex flex-col gap-3 ">
        <div className="flex flex-row items-center gap-3 pb-3">
          <img
            src={project.logoSrc}
            alt={`${project.name} logo`}
            className="size-16 shrink-0 rounded-md border bg-background object-cover"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-semibold">
              {project.name}
            </CardTitle>
            <Badge variant="outline" className="mt-0.5">
              {ECOSYSTEM_TAG_LABEL[project.tag] ?? project.tag}
            </Badge>
          </div>
          <Button variant="default" size="sm" asChild>
            <a href={project.url} target="_blank" rel="noreferrer">
              Visit
              <ArrowUpRight className="ml-1 h-4 w-4" />
              <span className="sr-only">Visit {project.name}</span>
            </a>
          </Button>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {project.description}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {networkBadges.map((b) => (
            <Badge key={b.key} variant={"secondary" as const}>
              {b.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Auto-discovered projects
// We build the project list by scanning folders under src/constants/ecosystem/*
// Each project folder must contain: metadata.json, logo.(svg|png|jpg|jpeg|webp), illustration.(svg|png|jpg|jpeg|webp)
const ECOSYSTEM_PROJECTS: EcosystemProject[] = (() => {
  const metadataModules = import.meta.glob(
    "@/constants/ecosystem/*/metadata.json",
    { eager: true, import: "default" },
  ) as Record<string, EcosystemProjectMetadata>;

  const logoModules = import.meta.glob(
    "@/constants/ecosystem/*/logo.{svg,png,jpg,jpeg,webp}",
    { eager: true, import: "default" },
  ) as Record<string, string>;

  const illustrationModules = import.meta.glob(
    "@/constants/ecosystem/*/illustration.{svg,png,jpg,jpeg,webp}",
    { eager: true, import: "default" },
  ) as Record<string, string>;

  const slugFromPath = (p: string) => {
    const m = p.match(/ecosystem\/([^/]+)\//);
    return m?.[1] ?? "";
  };

  const logoBySlug = Object.entries(logoModules).reduce<Record<string, string>>(
    (acc, [path, src]) => {
      const slug = slugFromPath(path);
      if (slug) acc[slug] = src as string;
      return acc;
    },
    {},
  );

  const illustrationBySlug = Object.entries(illustrationModules).reduce<
    Record<string, string>
  >((acc, [path, src]) => {
    const slug = slugFromPath(path);
    if (slug) acc[slug] = src as string;
    return acc;
  }, {});

  const projects: EcosystemProject[] = Object.entries(metadataModules)
    .map(([path, metadata]) => {
      const slug = slugFromPath(path);
      if (!slug) return null;
      const logoSrc = logoBySlug[slug];
      const illustrationSrc = illustrationBySlug[slug];
      if (!logoSrc || !illustrationSrc) return null; // require assets per contribution guide
      const networks =
        (metadata as EcosystemProjectMetadata).networks &&
          (metadata as EcosystemProjectMetadata).networks!.length > 0
          ? (metadata as EcosystemProjectMetadata).networks!
          : Object.keys(
            (metadata as EcosystemProjectMetadata).paymentTokensByNetwork ??
            {},
          );
      if (!(metadata as EcosystemProjectMetadata).tag) return null;
      return {
        slug,
        ...metadata,
        logoSrc,
        illustrationSrc,
        networks,
      } satisfies EcosystemProject;
    })
    .filter(Boolean) as EcosystemProject[];

  // Optional: stable order by name, then slug
  projects.sort(
    (a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
  );

  return projects;
})();

// Removed NetworkTokenRow: tokens summarized inline above for compact display

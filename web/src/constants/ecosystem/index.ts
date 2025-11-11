import type {
  EcosystemProject,
  EcosystemProjectMetadata,
} from "@/types/ecosystem";

import hookCommerceIllustration from "./hook-commerce/illustration.svg";
import hookCommerceLogo from "./hook-commerce/logo.svg";
import hookCommerceMetadata from "./hook-commerce/metadata.json";
import nuwaPayIllustration from "./nuwa-pay/illustration.svg";
import nuwaPayLogo from "./nuwa-pay/logo.svg";
import nuwaPayMetadata from "./nuwa-pay/metadata.json";

type ProjectBundle = {
  slug: string;
  metadata: EcosystemProjectMetadata;
  logoSrc: string;
  illustrationSrc: string;
};

const PROJECT_BUNDLES: ProjectBundle[] = [
  {
    slug: "hook-commerce",
    metadata: hookCommerceMetadata as EcosystemProjectMetadata,
    logoSrc: hookCommerceLogo,
    illustrationSrc: hookCommerceIllustration,
  },
  {
    slug: "nuwa-pay",
    metadata: nuwaPayMetadata as EcosystemProjectMetadata,
    logoSrc: nuwaPayLogo,
    illustrationSrc: nuwaPayIllustration,
  },
];

export const ECOSYSTEM_PROJECTS: EcosystemProject[] = PROJECT_BUNDLES.map(
  ({ slug, metadata, logoSrc, illustrationSrc }) => ({
    slug,
    ...metadata,
    logoSrc,
    illustrationSrc,
  }),
);

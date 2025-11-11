export type EcosystemProjectMetadata = {
  name: string;
  description: string;
  url: string;
  networks: string[];
  paymentTokensByNetwork: Record<string, string[]>;
};

export type EcosystemProject = EcosystemProjectMetadata & {
  slug: string;
  logoSrc: string;
  illustrationSrc: string;
};

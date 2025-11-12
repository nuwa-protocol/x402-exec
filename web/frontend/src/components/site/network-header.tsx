import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card";

type Props = {
  networkKey: string;
  name: string;
  status: "Mainnet" | "Testnet";
};

// Map network id -> logo asset path in /public
const NETWORK_LOGOS: Record<string, string> = {
  base: "/logos/base.svg",
  "base-sepolia": "/logos/base.svg",
  "x-layer": "/logos/x-layer.png",
  "x-layer-testnet": "/logos/x-layer.png",
};

export function NetworkHeader({ networkKey, name, status }: Props) {
  const logoUrl = NETWORK_LOGOS[networkKey];
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8 rounded-md">
        {logoUrl ? <AvatarImage src={logoUrl} alt={`${name} logo`} /> : null}
        <AvatarFallback className="text-xs font-semibold">
          {name?.[0] ?? "?"}
        </AvatarFallback>
      </Avatar>
      <CardTitle className="text-lg">{name}</CardTitle>
      <Badge variant={status === "Mainnet" ? "default" : "secondary"}>
        {status}
      </Badge>
    </div>
  );
}


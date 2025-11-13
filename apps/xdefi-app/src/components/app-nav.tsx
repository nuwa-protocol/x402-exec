import { useNetworkMode } from "@/contexts/NetworkModeContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
// AppKit provides the wallet connect button UI
// Note: packages will be added to the project; until then TS may show missing types
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { AppKitButton } from "@reown/appkit/react";

// Minimal floating nav using the visual style from simple-floating-nav.tsx
// Fixed, centered, and floating at the top. Contains Swap, Bridge, FAQ links.
export function AppNav() {
  return (
    <nav className="fixed left-1/2 top-4 z-50 flex w-fit -translate-x-1/2 items-center gap-4 rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-sm text-neutral-400 shadow-lg">
      <div className="mr-1 pr-2 border-r border-neutral-700/80 flex items-center gap-2">
        <NetworkModeSwitch />
      </div>

      <AppNavLink to="/swap">Swap</AppNavLink>
      <AppNavLink to="/bridge">Bridge</AppNavLink>
      <AppNavLink to="/faq">FAQ</AppNavLink>

      <div className="ml-1 pl-2 border-l border-neutral-700/80 flex items-center gap-2">
        {/* Connect Wallet button (AppKit) */}
        <div className="[&>*]:!m-0">
          {/* AppKit renders its own styled button */}
          <AppKitButton />
        </div>
      </div>
    </nav>
  );
}

function AppNavLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn("block overflow-hidden px-1", isActive && "text-neutral-100")
      }
    >
      <motion.div
        whileHover={{ y: -20 }}
        transition={{ ease: "backInOut", duration: 0.5 }}
        className="h-[20px]"
      >
        <span className="flex h-[20px] items-center">{children}</span>
        <span className="flex h-[20px] items-center text-neutral-50">
          {children}
        </span>
      </motion.div>
    </NavLink>
  );
}

function NetworkModeSwitch() {
  const { mode, setMode } = useNetworkMode();
  const isMainnet = mode === "mainnet";
  return (
    <div className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800/70 p-0.5">
      <button
        type="button"
        onClick={() => setMode("mainnet")}
        className={cn(
          "px-2 py-1 rounded-md transition-colors",
          isMainnet
            ? "bg-neutral-700 text-neutral-50"
            : "text-neutral-300 hover:text-neutral-50 hover:bg-neutral-700/60",
        )}
        title="Mainnet mode"
      >
        Mainnet
      </button>
      <button
        type="button"
        onClick={() => setMode("testnet")}
        className={cn(
          "px-2 py-1 rounded-md transition-colors",
          !isMainnet
            ? "bg-neutral-700 text-neutral-50"
            : "text-neutral-300 hover:text-neutral-50 hover:bg-neutral-700/60",
        )}
        title="Testnet mode"
      >
        Testnet
      </button>
    </div>
  );
}

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { NavLink } from "react-router-dom";

// Minimal floating nav using the visual style from simple-floating-nav.tsx
// Fixed, centered, and floating at the top. Contains Swap, Bridge, FAQ links.
export function FloatingNav() {
  return (
    <nav className="fixed left-1/2 top-4 z-50 flex w-fit -translate-x-1/2 items-center gap-4 rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-sm text-neutral-400 shadow-lg">
      <FloatingNavLink to="/swap">Swap</FloatingNavLink>
      <FloatingNavLink to="/bridge">Bridge</FloatingNavLink>
      <FloatingNavLink to="/faq">FAQ</FloatingNavLink>

      <div className="ml-1 pl-2 border-l border-neutral-700/80">
        <ThemeSwitch />
      </div>
    </nav>
  );
}

function FloatingNavLink({ to, children }: { to: string; children: string }) {
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

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800/70 px-2 py-1 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-50 transition-colors"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline capitalize">
        {isDark ? "Light" : "Dark"}
      </span>
    </button>
  );
}

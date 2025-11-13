import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

// Small theme switcher button used in the footer.
export default function ThemeSwitch() {
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


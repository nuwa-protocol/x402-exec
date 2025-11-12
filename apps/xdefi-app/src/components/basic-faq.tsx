import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

// Simple FAQ component without external measuring deps
export default function BasicFAQ() {
  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h3 className="mb-6 text-center text-2xl font-semibold text-foreground">
          Frequently asked questions
        </h3>

        <Question title="Which networks can I use?" defaultOpen>
          <p>
            The demo supports multiple networks and groups assets by network in the selector.
            You can choose the network first, then pick the asset.
          </p>
        </Question>
        <Question title="What’s the difference between Swap and Bridge?">
          <p>
            Swap trades tokens on the same network. Bridge moves assets between different networks.
          </p>
        </Question>
        <Question title="Is a wallet required?">
          <p>
            Not in this demo. The UI simulates interactions without connecting to a wallet.
          </p>
        </Question>
        <Question title="Can I customize networks and tokens?">
          <p>
            Yes. The component accepts network data and can be extended to real chain metadata.
          </p>
        </Question>
      </div>
    </div>
  );
}

function Question({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Measure content height to animate between 0 and scrollHeight
  const measure = () => {
    const el = contentRef.current;
    if (el) setHeight(el.scrollHeight);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <>
  useLayoutEffect(() => {
    measure();
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <>
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <motion.div
      animate={open ? "open" : "closed"}
      className="border-b border-border"
    >
      <button
        type="button"
        onClick={() => setOpen((pv) => !pv)}
        className="flex w-full items-center justify-between gap-4 py-4"
      >
        {/* Title uses gradient text that works in both light/dark */}
        <span
          className="bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent text-left text-base font-medium"
        >
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className={open ? 'text-violet-600 dark:text-violet-400' : 'text-foreground'}
        >
          <FiChevronDown className="text-xl" />
        </motion.span>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? height : 0, marginBottom: open ? 20 : 0 }}
        className="overflow-hidden text-muted-foreground"
      >
        <div ref={contentRef} className="pb-2">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

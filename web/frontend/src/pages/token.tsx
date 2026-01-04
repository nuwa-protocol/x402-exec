import { Distribution } from "@/components/token/distribution";
import { FAQ } from "@/components/token/faq";
import { Hero } from "@/components/token/hero";
import { ValueCapture } from "@/components/token/value-capture";
import { X402ToEarn } from "@/components/token/x402-to-earn";
import { useEffect, useState } from "react";

export const TokenPage = () => {
    const [activeSection, setActiveSection] = useState("mint");

    const navItems = [
        // { label: "Mint", id: "mint" },
        { label: "Overview", id: "overview" },
        { label: "Value Capture", id: "value-capture" },
        { label: "Distribution", id: "distribution" },
        { label: "x402-to-Earn", id: "x402-to-earn" },
        { label: "FAQ", id: "faq" },
    ];

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            // Offset for the sticky header
            const offset = 80;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth",
            });
            setActiveSection(id);
        }
    };

    // Optional: Update active tab on scroll
    useEffect(() => {
        const handleScroll = () => {
            const sections = navItems.map((item) => document.getElementById(item.id));
            const scrollPosition = window.scrollY + 100;

            // Update sticky nav active section based on scroll position
            for (const section of sections) {
                if (
                    section &&
                    section.offsetTop <= scrollPosition &&
                    section.offsetTop + section.offsetHeight > scrollPosition
                ) {
                    setActiveSection(section.id);
                }
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        // Wrapper div designed to be embedded. Light theme base.
        // <TokenAppKitProvider>
        <div className="w-full text-slate-900 font-sans selection:bg-yellow-200 selection:text-black">
            {/* Sticky Internal Navigation pinned below the main navbar (single wrapper div) */}
            <div className="sticky top-14 z-40 bg-white/80 backdrop-blur-md border-y border-slate-200 shadow-sm flex items-center justify-center overflow-x-auto no-scrollbar py-1 px-4 sm:px-6 lg:px-8 space-x-1 md:space-x-6">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToSection(item.id)}
                        className={`
                    px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2
                    ${activeSection === item.id
                                ? "border-yellow-500 text-slate-900"
                                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                            }
                  `}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Content Sections */}
            <div className="space-y-0">
                {/* <section
                    id="mint"
                    className="py-10 bg-slate-50 border-b border-slate-200"
                >
                    <TokenMint />
                </section> */}
                <section
                    id="overview"
                    className="py-10 bg-white border-b border-slate-200"
                >
                    <Hero />
                </section>
                <section id="value-capture" className="py-24 bg-slate-50">
                    <ValueCapture />
                </section>
                <section
                    id="distribution"
                    className="py-24 bg-white border-b border-slate-200"
                >
                    <Distribution />
                </section>
                <section
                    id="x402-to-earn"
                    className="py-24 bg-slate-50 border-b border-slate-200"
                >
                    <X402ToEarn />
                </section>
                <section id="faq" className="py-24">
                    <FAQ />
                </section>
            </div>
        </div>
        // </TokenAppKitProvider>
    );
};

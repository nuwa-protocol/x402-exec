import { useEffect, useState } from "react";
import { Distribution } from "./distribution";
import { FAQ } from "./faq";
import { Hero } from "./hero";
import { ValueCapture } from "./value-capture";
import { X402ToEarn } from "./x402-to-earn";

export const TokenPage = () => {
    const [activeSection, setActiveSection] = useState("overview");

    const navItems = [
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
        <div className="w-full text-slate-900 font-sans selection:bg-yellow-200 selection:text-black">

            {/* Sticky Internal Navigation */}
            <div className="sticky top-14 z-40 bg-white/80 backdrop-blur-md border-y border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-center md:justify-start overflow-x-auto no-scrollbar py-1">
                        <div className="flex space-x-1 md:space-x-6">
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
                    </div>
                </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-0">
                <section id="overview" className="py-24 bg-white border-b border-slate-200">
                    <Hero />
                </section>
                <section id="value-capture" className="py-24 bg-slate-50">
                    <ValueCapture />
                </section>
                <section id="distribution" className="py-24 bg-white border-b border-slate-200">
                    <Distribution />
                </section>

                <section id="x402-to-earn" className="py-24 bg-slate-50 border-b border-slate-200">
                    <X402ToEarn />
                </section>
                <section id="faq" className="py-24">
                    <FAQ />
                </section>
            </div>
        </div>
    );
};

import Footer from "@/components/site/footer";
import Hero from "@/components/site/hero";
import Navbar from "@/components/site/navbar";
import DocsPage from "@/pages/docs";
import EcosystemPage from "@/pages/ecosystem";
import FacilitatorPage from "@/pages/facilitator";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

function App() {
  const location = useLocation();

  // Basic client-side SEO: update document title based on route
  useEffect(() => {
    const base = "x402x";
    const pathname = location.pathname.replace(/^\/+/, "");
    const route = pathname.startsWith("docs")
      ? "docs"
      : pathname.startsWith("facilitator")
        ? "facilitator"
        : pathname.startsWith("ecosystem")
          ? "ecosystem"
          : "home";
    const title =
      route === "docs"
        ? `${base} • Docs`
        : route === "facilitator"
          ? `${base} • Facilitator`
          : route === "ecosystem"
            ? `${base} • Ecosystem`
            : `${base} - Turn any x402 payment into an on-chain action`;
    if (typeof document !== "undefined") {
      document.title = title;
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Site-wide notice: production launch */}
        <div className="mx-auto max-w-6xl px-4 pt-4"></div>
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/docs/:slug" element={<DocsPage />} />
          <Route path="/facilitator" element={<FacilitatorPage />} />
          <Route path="/ecosystem" element={<EcosystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;

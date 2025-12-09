import Footer from "@/components/site/footer";
import Hero from "@/components/site/hero";
import Navbar from "@/components/site/navbar";
import ActivitiesPage from "@/pages/activities";
import DebugPage from "@/pages/debug";
import DocsPage from "@/pages/docs";
import EcosystemPage from "@/pages/ecosystem";
import FacilitatorPage from "@/pages/facilitator";
import { TokenPage } from "@/pages/token";
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
          : pathname.startsWith("activities")
            ? "activities"
            : pathname.startsWith("token")
              ? "token"
              : pathname.startsWith("debug")
                ? "debug"
                : "home";
    const title =
      route === "docs"
        ? `${base} • Docs`
        : route === "facilitator"
          ? `${base} • Facilitator`
          : route === "ecosystem"
            ? `${base} • Ecosystem`
            : route === "activities"
              ? `${base} • Activities`
              : route === "token"
                ? `${base} • Token Mint`
                : route === "debug"
                  ? `${base} • Debug`
                  : `${base} - Turn any x402 payment into an on-chain action`;
    if (typeof document !== "undefined") {
      document.title = title;
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/docs/:slug" element={<DocsPage />} />
          <Route path="/facilitator" element={<FacilitatorPage />} />
          <Route path="/ecosystem" element={<EcosystemPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route
            path="/stats"
            element={<Navigate to="/activities" replace />}
          />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/token" element={<TokenPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;

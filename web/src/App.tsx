import Footer from "@/components/site/footer";
import Hero from "@/components/site/hero";
import Navbar from "@/components/site/navbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import DocsPage from "@/pages/docs";
import FacilitatorPage from "@/pages/facilitator";

function App() {
  // extremely light-weight hash-based routing to avoid adding a router dep
  const getRoute = () => {
    const hash = (typeof window !== "undefined" ? window.location.hash : "").replace(
      /^#\/?/,
      "",
    );
    if (hash.startsWith("docs")) return "docs" as const;
    if (hash.startsWith("facilitator")) return "facilitator" as const;
    return "home" as const;
  };

  const [route, setRoute] = useState<"home" | "docs" | "facilitator">(getRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Basic client-side SEO: update document title based on route
  useEffect(() => {
    const base = "x402X";
    const title = route === "docs" ? `${base} • Docs` : route === "facilitator" ? `${base} • Facilitator` : `${base} • Atomic Pay-and-Execute`;
    if (typeof document !== "undefined") {
      document.title = title;
    }
  }, [route]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Site-wide notice: experimental status */}
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <Alert className="bg-yellow-50 border-yellow-200 text-yellow-900">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Experimental Project</AlertTitle>
            <AlertDescription>
              This project is experimental and not ready for production yet.
              Please refer to our github for the latest progress or provide
              feedbacks.
            </AlertDescription>
          </Alert>
        </div>
        {route === "home" ? <Hero /> : null}
        {route === "docs" ? <DocsPage /> : null}
        {route === "facilitator" ? <FacilitatorPage /> : null}
      </main>
      <Footer />
    </div>
  );
}

export default App;

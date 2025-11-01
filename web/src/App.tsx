import Footer from "@/components/site/footer";
import Hero from "@/components/site/hero";
import Navbar from "@/components/site/navbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";

function App() {
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
        <Hero />
      </main>
      <Footer />
    </div>
  );
}

export default App;

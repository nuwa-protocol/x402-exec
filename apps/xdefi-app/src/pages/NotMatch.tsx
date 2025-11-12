import { buttonVariants } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";

export default function NotMatch() {
    return (
        <div className="flex-grow flex items-center justify-center">
            <Seo title="404 Not Found" description="The page you’re looking for does not exist." noIndex path={window.location.pathname} />
            <div className="space-y-4">
                <h2 className="text-8xl mb-4">404</h2>
                <h1 className="text-3xl font-semibold">Oops! Page not found</h1>
                <p className="text-sm text-muted-foreground">We are sorry, but the page you requested was not found</p>
                <Link to="/" className={buttonVariants()}>Back to Home</Link>
            </div>
        </div>
    )
}

import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FaGithub } from "react-icons/fa6";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          className="px-2 font-semibold"
          onClick={() => window.location.assign("/")}
        >
          {/* <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs">
            ⚡
          </span> */}
          <span className="ml-2">x402-exec</span>
        </Button>
        <NavigationMenu className="hidden md:flex" viewport={false}>
          <NavigationMenuList className="justify-end">
            {/* <NavigationMenuItem>
              <NavigationMenuLink
                href="https://github.com/nuwa-protocol/x402-exec#readme"
                target="_blank"
                rel="noreferrer"
              >
                Docs
              </NavigationMenuLink>
            </NavigationMenuItem> */}
            <NavigationMenuItem>
              <NavigationMenuLink
                href="https://github.com/nuwa-protocol/x402-exec"
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-row h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-ring/50 outline-none transition-colors focus-visible:ring-[3px] focus-visible:outline-1 gap-2"
              >
                <span className="inline-block">
                  <FaGithub className="h-4 w-4" />
                </span>
                Star
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavigationMenuLink
                    href="#diagram"
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
                  >
                    Try the demo
                  </NavigationMenuLink>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Coming soon</p>
                  <p>
                    We are working on the demo and will release it soon. Please
                    stay tuned.
                  </p>
                </TooltipContent>
              </Tooltip>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}

export default Navbar;

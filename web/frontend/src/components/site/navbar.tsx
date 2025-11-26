import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { FaGithub } from "react-icons/fa6";
import { Link, useLocation } from "react-router-dom";

export function Navbar() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Button
          variant="ghost"
          size="sm"
          className="px-2 font-semibold"
          asChild
        >
          <Link to="/" className="inline-flex items-center">
            {/* <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-xs">
              ⚡
            </span> */}
            <span className="ml-2 text-xl font-bold tracking-tight">x402x</span>
          </Link>
        </Button>
        <NavigationMenu className="hidden md:flex" viewport={false}>
          <NavigationMenuList className="justify-end">
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                data-active={pathname === "/" ? true : undefined}
              >
                <Link to="/">Home</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                data-active={pathname.startsWith("/docs") ? true : undefined}
              >
                <Link to="/docs">Docs</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                data-active={pathname.startsWith("/activities") ? true : undefined}
              >
                <Link to="/activities">Activities</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                data-active={
                  pathname.startsWith("/facilitator") ? true : undefined
                }
              >
                <Link to="/facilitator">Facilitator</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                data-active={
                  pathname.startsWith("/ecosystem") ? true : undefined
                }
              >
                <Link to="/ecosystem">Ecosystem</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            {/* <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                data-active={pathname.startsWith("/token") ? true : undefined}
              >
                <Link to="/token">$X402X</Link>
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
                Github
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </header>
  );
}

export default Navbar;

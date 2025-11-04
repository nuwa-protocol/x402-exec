import { Button } from "@/components/ui/button"

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
          <p className="flex flex-col">
            <span className="font-semibold text-foreground">x402X © {new Date().getFullYear()}</span>
            <span>
              This is a project from <a href="https://x.com/NuwaDev" target="_blank" rel="noreferrer" className="underline hover:text-foreground">Nuwa AI</a>. x402X is short for x402-exec.
            </span>
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="link"
              className="p-0 text-muted-foreground hover:text-foreground"
              onClick={() => window.open('https://github.com/nuwa-protocol/x402-exec', '_blank')}
            >
              GitHub
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

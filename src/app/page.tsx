import { Logo } from "@/components/brand/Logo";
import { DeclarationWizard } from "@/components/declaration/DeclarationWizard";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Fil d'Ariane" className="hidden items-center gap-2 text-sm text-muted sm:flex">
            <span>Mes œuvres</span>
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-medium text-foreground">Nouvelle déclaration</span>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <DeclarationWizard />
      </main>
    </div>
  );
}

import { DeclarationWizard } from "@/components/declaration/DeclarationWizard";

export default function Home() {
  return (
    <main className="flex-1">
      <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold tracking-[0.18em]">
            SONIQ <span className="text-accent">RIGHTS</span>
          </span>
          <span className="text-xs text-muted">Nouvelle déclaration</span>
        </div>
      </header>
      <DeclarationWizard />
    </main>
  );
}

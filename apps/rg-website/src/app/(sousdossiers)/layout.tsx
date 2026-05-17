export default function SousDossiersLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 animate-fade-in">
      {children}
    </main>
  );
}

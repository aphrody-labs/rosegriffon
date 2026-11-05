import Link from "next/link";

export interface FooterProps {
  className?: string;
}

/**
 * Pied de page applicatif compact.
 *
 * La navigation principale et les réseaux sont déjà disponibles dans le
 * chrome de l'application. Le footer ne conserve donc que les accès légaux
 * indispensables, sans recréer plusieurs colonnes de navigation.
 */
/** Year of the server build or of the client module evaluation, outside render. */
const currentYear = new Date().getFullYear();

const LEGAL_LINKS = [
  { href: "/a-propos/contact", label: "Contact" },
  { href: "/legal/mentions-legales", label: "Mentions légales" },
  { href: "/legal/cgu", label: "CGU" },
  { href: "/legal/confidentialite", label: "Confidentialité" },
] as const;

export function Footer({ className }: FooterProps = {}) {

  return (
    <footer className={`mt-auto w-full border-t border-outline-variant/10 bg-surface-container ${className ?? ""}`}>
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 text-xs text-on-surface-variant md:px-8">
        <p>© {currentYear} Rose Griffon</p>
        <nav aria-label="Informations légales" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {LEGAL_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-6 items-center pointer-coarse:min-h-11 rounded px-1.5 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export { Footer as AzaleeFooter };
export default Footer;

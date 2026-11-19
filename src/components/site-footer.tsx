import Image from "next/image";
import Link from "next/link";
import FacebookButton from "@/components/facebook-button";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";

type SiteFooterProps = {
  address: string;
  facebookUrl: string;
  hasNews: boolean;
  hasPhotos: boolean;
};

const linkClass = "transition-colors hover:text-white hover:underline";

export default function SiteFooter({ address, facebookUrl, hasNews, hasPhotos }: SiteFooterProps) {
  return (
    <footer className="mt-auto bg-brand-blue-dark text-[#dbe6f6]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-7 pt-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-block rounded-2xl bg-white px-3.5 py-2">
              <Image src="/logo.png" alt="Activ' Sainte-Croix Sport et Culture" width={561} height={445} className="h-16 w-auto" />
            </span>
            <p className="mt-4 max-w-xs text-[15px]">
              Association sportive et culturelle de Sainte-Croix-sur-Buchy.
            </p>
          </div>

          <div>
            <h2 className="mb-3.5 text-sm font-bold uppercase tracking-wider text-white">Nous trouver</h2>
            <address className="text-[15px] not-italic">
              {address || "Sainte-Croix-sur-Buchy"}
            </address>
            <p className="mt-2.5 text-[15px]">
              <a href={ASSOCIATION_PHONE_TEL} className={`font-bold text-white ${linkClass}`}>
                {ASSOCIATION_PHONE_DISPLAY}
              </a>
            </p>
          </div>

          <div>
            <h2 className="mb-3.5 text-sm font-bold uppercase tracking-wider text-white">Le site</h2>
            <ul className="space-y-2 text-[15px]">
              <li><Link href="/#planning" className={linkClass}>Planning</Link></li>
              <li><Link href="/#disciplines" className={linkClass}>Disciplines</Link></li>
              {hasNews ? <li><Link href="/actualites" className={linkClass}>Actualités</Link></li> : null}
              {hasPhotos ? <li><Link href="/galerie" className={linkClass}>Photos</Link></li> : null}
              <li><Link href="/contact" className={linkClass}>Contact</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3.5 text-sm font-bold uppercase tracking-wider text-white">L&apos;association</h2>
            <ul className="space-y-2 text-[15px]">
              <li><Link href="/association" className={linkClass}>Qui sommes-nous ? (organigramme)</Link></li>
              <li><Link href="/preinscription" className={linkClass}>Pré-inscription</Link></li>
              <li><Link href="/sign-in" className={linkClass}>Connexion adhérents</Link></li>
            </ul>
            {facebookUrl ? (
              <div className="mt-4">
                <FacebookButton href={facebookUrl} label="Suivez-nous sur Facebook" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 border-t border-white/15 pt-5 text-[13px] text-[#a9bddb]">
          © {new Date().getFullYear()} Activ&apos; Sainte-Croix Sport et Culture
        </div>
      </div>
    </footer>
  );
}

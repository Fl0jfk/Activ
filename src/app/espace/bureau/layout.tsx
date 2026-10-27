import type { ReactNode } from "react";
import BureauToolNav from "@/components/bureau-tool-nav";
import { requireBureauPageAccess } from "@/lib/bureau-page-data";

export const dynamic = "force-dynamic";

export default async function BureauToolsLayout({ children }: { children: ReactNode }) {
  const { canManageSite } = await requireBureauPageAccess();

  return (
    <main className="min-w-0 overflow-x-hidden pb-20">
      <section className="pt-4">
        <BureauToolNav canManageSite={canManageSite} />
      </section>
      {children}
    </main>
  );
}

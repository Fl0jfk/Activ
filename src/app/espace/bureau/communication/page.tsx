import BureauBroadcastPanel from "@/components/bureau-broadcast-panel";
import BureauPageHeader from "@/components/bureau-page-header";
import { loadBureauPageData } from "@/lib/bureau-page-data";

export const dynamic = "force-dynamic";

export default async function BureauCommunicationPage() {
  const data = await loadBureauPageData();

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 pb-10 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Communication"
        title="Communication"
        description="Écrivez un e-mail à tous les adhérents, à une activité ou à une personne. Les adresses des destinataires restent cachées."
      />

      <div className="max-w-4xl">
        <BureauBroadcastPanel disciplines={data.disciplines} />
      </div>
    </div>
  );
}

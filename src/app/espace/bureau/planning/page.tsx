import BureauPageHeader from "@/components/bureau-page-header";
import CoachAbsencePanel from "@/components/coach-absence-panel";
import ScheduleExceptionsPanel from "@/components/schedule-exceptions-panel";
import TrialSlotsPanel from "@/components/trial-slots-panel";
import { loadBureauPageData } from "@/lib/bureau-page-data";

export const dynamic = "force-dynamic";

export default async function BureauPlanningPage() {
  const data = await loadBureauPageData();

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Planning"
        title="Essais & planning"
        description="Créez les créneaux d’essai, ajustez les séances de la semaine et validez les absences des coachs."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
              {data.slots.length} créneau{data.slots.length > 1 ? "x" : ""} d&apos;essai
            </span>
            {data.canApproveCoachAbsences ? (
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                  data.coachAbsencePendingCount > 0
                    ? "bg-violet-600 text-white ring-violet-600"
                    : "bg-violet-50 text-violet-700 ring-violet-100"
                }`}
              >
                {data.coachAbsencePendingCount > 0
                  ? `${data.coachAbsencePendingCount} absences à valider`
                  : "Absences coach à jour"}
              </span>
            ) : null}
          </div>
        }
      />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        <section className="bento-card min-w-0 p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Essais
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Prochains créneaux
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Inscriptions aux séances d’essai et suivi des présences.
            </p>
          </div>
          <TrialSlotsPanel
            disciplines={data.disciplines}
            slots={data.slots}
            applications={data.applications}
          />
        </section>

        <ScheduleExceptionsPanel canManageSite={data.canManageSite} />
      </div>

      {data.canApproveCoachAbsences ? (
        <section
          id="absences-coach"
          className="anchor-section bento-card min-w-0 p-5 sm:p-6"
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-700">
                Réservé au président
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Absences coach
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Une fois validée, l’absence apparaît sur le site et les adhérents de la discipline
                sont prévenus par e-mail.
              </p>
            </div>
          </div>
          <CoachAbsencePanel disciplines={data.disciplines} />
        </section>
      ) : null}
    </div>
  );
}

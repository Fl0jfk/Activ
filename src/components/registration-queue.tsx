"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/bureau-ui";
import DossierCard from "@/components/dossier-card";
import { useClubApplicationActions } from "@/hooks/useClubApplicationActions";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import { matchesDossierSearch, sortDossiers, type DossierSort } from "@/lib/dossier-format";
import {
  filterApplicationsByQueue,
  matchesStepFilter,
  type QueueFilter,
  type StepFilter,
} from "@/lib/dossier-workflow";

export type { QueueFilter };

const PAGE_SIZE = 15;

type RegistrationQueueProps = {
  disciplines: DisciplineOption[];
  /** Dossiers déjà filtrés par activité. */
  applications: RegistrationApplication[];
  queueFilter: QueueFilter;
  stepFilter: StepFilter | null;
  query: string;
  sort: DossierSort;
  /** Change dès que l’utilisateur modifie un filtre : le dossier ouvert est alors refermé. */
  filterKey: string;
};

export default function RegistrationQueue({
  disciplines,
  applications,
  queueFilter,
  stepFilter,
  query,
  sort,
  filterKey,
}: RegistrationQueueProps) {
  const [expanded, setExpanded] = useState<{ id: string; key: string } | null>(null);
  const [pageState, setPageState] = useState<{ count: number; key: string }>({
    count: PAGE_SIZE,
    key: filterKey,
  });
  const actions = useClubApplicationActions();

  const expandedId = expanded && expanded.key === filterKey ? expanded.id : null;
  const visibleCount = pageState.key === filterKey ? pageState.count : PAGE_SIZE;

  const { matching, shown, outsideFilterId } = useMemo(() => {
    let list = filterApplicationsByQueue(applications, queueFilter);
    if (stepFilter) list = list.filter((application) => matchesStepFilter(application, stepFilter));
    if (query.trim()) list = list.filter((application) => matchesDossierSearch(application, query));
    const matchingList = sortDossiers(list, sort);

    const page = matchingList.slice(0, visibleCount);
    let outside: string | null = null;
    if (expandedId && !page.some((application) => application.id === expandedId)) {
      const open = applications.find((application) => application.id === expandedId);
      if (open) {
        page.push(open);
        if (!matchingList.some((application) => application.id === expandedId)) outside = expandedId;
      }
    }
    return { matching: matchingList, shown: page, outsideFilterId: outside };
  }, [applications, queueFilter, stepFilter, query, sort, visibleCount, expandedId]);

  function toggle(applicationId: string) {
    setExpanded((current) =>
      current && current.key === filterKey && current.id === applicationId
        ? null
        : { id: applicationId, key: filterKey },
    );
    actions.notify(applicationId, null);
    actions.dismissSecureLink();
  }

  const countLine = (
    <p aria-live="polite" className="text-sm font-semibold text-slate-700">
      {matching.length === 0
        ? "Aucun dossier"
        : matching.length === 1
          ? "1 dossier"
          : `${matching.length} dossiers`}
    </p>
  );

  if (shown.length === 0) {
    return (
      <div className="space-y-3">
        {countLine}
        <EmptyState>
          {query.trim()
            ? "Aucun dossier ne correspond à votre recherche."
            : "Aucun dossier à afficher dans cet onglet."}
        </EmptyState>
      </div>
    );
  }

  const remaining = matching.length - visibleCount;

  return (
    <div className="space-y-3">
      {countLine}
      {shown.map((application) => (
        <DossierCard
          key={application.id}
          application={application}
          disciplines={disciplines}
          expanded={expandedId === application.id}
          outsideFilters={outsideFilterId === application.id}
          feedback={actions.feedbackFor(application.id)}
          actions={actions}
          onToggle={() => toggle(application.id)}
        />
      ))}

      {remaining > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-sm text-slate-600">
            {Math.min(visibleCount, matching.length)} dossiers affichés sur {matching.length}
          </p>
          <button
            type="button"
            onClick={() => setPageState({ count: visibleCount + PAGE_SIZE, key: filterKey })}
            className="btn btn-outline btn-sm"
          >
            Afficher {Math.min(PAGE_SIZE, remaining)} dossiers de plus
          </button>
        </div>
      ) : null}
    </div>
  );
}

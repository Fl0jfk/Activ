import { parseScheduleTimeToMinutes, type WeekScheduleEntry } from "@/lib/schedule-week";

export type PositionedEntry = WeekScheduleEntry & {
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
};

/** Répartit les séances d'une journée qui se chevauchent sur plusieurs colonnes. */
export function positionDay(entries: WeekScheduleEntry[]): PositionedEntry[] {
  const sorted = entries
    .flatMap((entry) => {
      const parsedStart = parseScheduleTimeToMinutes(entry.startTime);
      const parsedEnd = parseScheduleTimeToMinutes(entry.endTime);
      if (parsedStart === null && parsedEnd === null) return [];
      const startMin = parsedStart ?? Math.max(0, (parsedEnd ?? 0) - 60);
      const endMin = parsedEnd ?? Math.min(24 * 60, startMin + 60);
      return [
        {
          entry,
          startMin,
          endMin: Math.max(endMin, startMin + 15),
        },
      ];
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const positioned: PositionedEntry[] = [];
  let cluster: typeof sorted = [];
  let clusterEnd = -1;

  function flushCluster() {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assignments = cluster.map(({ entry, startMin, endMin }) => {
      let lane = laneEnds.findIndex((end) => end <= startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(endMin);
      } else {
        laneEnds[lane] = endMin;
      }
      return { ...entry, startMin, endMin, lane };
    });
    const lanes = Math.max(1, laneEnds.length);
    positioned.push(...assignments.map((item) => ({ ...item, lanes })));
    cluster = [];
    clusterEnd = -1;
  }

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) {
      flushCluster();
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flushCluster();

  return positioned;
}

export function buildPositionedEntries(entries: WeekScheduleEntry[]): PositionedEntry[] {
  return Array.from({ length: 7 }, (_, index) =>
    positionDay(entries.filter((entry) => entry.dayOfWeek === index + 1)),
  ).flat();
}

/** Séances sans horaire exploitable (ex. sortie mensuelle) : affichées à part. */
export function hasUsableTime(entry: WeekScheduleEntry): boolean {
  return parseScheduleTimeToMinutes(entry.startTime) !== null || parseScheduleTimeToMinutes(entry.endTime) !== null;
}

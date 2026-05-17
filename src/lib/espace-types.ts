export type UpcomingEvent = {
  id: string;
  title: string;
  date: string;
  description: string;
  disciplineName: string;
};

export type PendingDocument = {
  applicationId: string;
  label: string;
  uploadUrl: string;
} | null;

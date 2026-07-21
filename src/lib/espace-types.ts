export type UpcomingEvent = {
  id: string;
  title: string;
  date: string;
  description: string;
  disciplineName: string;
  kind: string;
  location: string;
  startTime: string;
  endTime: string;
  imageUrl: string;
};

export type PendingDocument = {
  applicationId: string;
  label: string;
  uploadUrl: string;
} | null;

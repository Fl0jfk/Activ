import type { DayOfWeek } from "@/lib/schedule-constants";

export type SiteNewsItem = {
  id: string;
  title: string;
  date: string;
  description: string;
  kind: string;
  location: string;
  startTime: string;
  endTime: string;
  disciplineId: string | null;
  imageUrl: string;
  galleryImages: string[];
};

export type Discipline = {
  id: string;
  name: string;
  slug: string;
  description: string;
  teacher: string;
  teachers: string[];
  coachBio: string;
  coachPhotoUrl?: string;
  imageUrl: string;
  galleryImages: string[];
  whatToBring: string[];
  providedItems: string[];
  priceInfo: string;
  annualFee: string;
  contactEmail: string;
  ctaText: string;
  allowTrialRequest: boolean;
  highlights: string[];
  active: boolean;
};

export type ScheduleSlot = {
  id: string;
  disciplineId: string;
  teacherName: string;
  day: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  location: string;
  active: boolean;
};

export type ScheduleException = {
  id: string;
  scheduleSlotId: string;
  date: string;
  status: "cancelled";
  reason: string;
};

/** Slide de la galerie d’accueil (ordre = index dans le tableau). */
export type HomeGallerySlide = {
  id: string;
  imageUrl: string;
  caption: string;
};

export type HomeGallery = {
  title: string;
  slides: HomeGallerySlide[];
};

export type AssociationData = {
  association: {
    name: string;
    tagline: string;
    city: string;
    contactEmail: string;
    facebookUrl: string;
    address: string;
    organisation: {
      boardMembers: {
        id: string;
        fullName: string;
        role: string;
        email: string;
      }[];
      notes: string;
    };
  };
  news: SiteNewsItem[];
  homeGallery: HomeGallery;
  disciplines: Discipline[];
  schedule: ScheduleSlot[];
  scheduleExceptions: ScheduleException[];
};

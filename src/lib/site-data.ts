import { readFile } from "node:fs/promises";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

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
  events: {
    id: string;
    title: string;
    date: string;
    description: string;
    featuredOnHome: boolean;
  }[];
  active: boolean;
};

export type ScheduleSlot = {
  id: string;
  disciplineId: string;
  teacherName: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  active: boolean;
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
  disciplines: Discipline[];
  schedule: ScheduleSlot[];
};

const defaultSiteDataPath = `${process.cwd()}/data/site-data.json`;
const defaultSiteDataKey = "data/site-data.json";

function createS3Client() {
  const region = process.env.REGION || "eu-west-1";

  return new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID || "",
      secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
    },
  });
}

function requireBucketConfig() {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing S3_BUCKET_NAME environment variable.");
  }

  return {
    bucketName,
    siteDataKey: process.env.SITE_DATA_KEY || defaultSiteDataKey,
  };
}

async function readDefaultLocalData(): Promise<AssociationData> {
  try {
    const content = await readFile(defaultSiteDataPath, "utf-8");
    return normalizeSiteData(JSON.parse(content) as AssociationData);
  } catch {
    return normalizeSiteData({
      association: {
        name: "Activ Sainte-Croix",
        tagline: "Association sportive",
        city: "Sainte-Croix",
        contactEmail: "contact@activ-saintecroix.fr",
        facebookUrl: "https://facebook.com",
        address: "Mairie de Sainte-Croix",
        organisation: {
          boardMembers: [],
          notes: "Organigramme a completer.",
        },
      },
      disciplines: [],
      schedule: [],
    });
  }
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

function normalizeSiteData(data: AssociationData): AssociationData {
  return {
    association: {
      ...data.association,
      organisation: {
        boardMembers: data.association.organisation?.boardMembers ?? [
          {
            id: "presidence",
            fullName: "Presidence a definir",
            role: "President(e)",
            email: data.association.contactEmail,
          },
        ],
        notes:
          data.association.organisation?.notes ?? "L'organigramme peut etre ajuste depuis les donnees JSON.",
      },
    },
    disciplines: data.disciplines.map((discipline) => ({
      id: discipline.id,
      name: discipline.name,
      slug: discipline.slug ?? slugify(discipline.name || discipline.id),
      description: discipline.description ?? "",
      teacher: discipline.teacher ?? "",
      teachers:
        Array.isArray(discipline.teachers) && discipline.teachers.length > 0
          ? discipline.teachers.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
          : discipline.teacher
            ? [discipline.teacher]
            : [],
      coachBio: discipline.coachBio ?? "",
      coachPhotoUrl: discipline.coachPhotoUrl ?? discipline.imageUrl ?? "/logo.png",
      imageUrl: discipline.imageUrl ?? "/logo.png",
      galleryImages: discipline.galleryImages ?? [],
      whatToBring: discipline.whatToBring ?? [],
      providedItems: discipline.providedItems ?? [],
      priceInfo: discipline.priceInfo ?? "Tarif sur demande.",
      annualFee: discipline.annualFee ?? "",
      contactEmail: discipline.contactEmail ?? data.association.contactEmail,
      ctaText: discipline.ctaText ?? "Demander un cours d'essai",
      allowTrialRequest: discipline.allowTrialRequest ?? true,
      highlights: discipline.highlights ?? [],
      events: discipline.events ?? [],
      active: discipline.active ?? true,
    })),
    schedule: data.schedule.map((slot) => ({
      ...slot,
      teacherName: slot.teacherName ?? "",
      active: slot.active ?? true,
    })),
  };
}

export async function readSiteData(): Promise<AssociationData> {
  const { bucketName, siteDataKey } = requireBucketConfig();
  const s3 = createS3Client();
  try {
    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucketName, Key: siteDataKey})
    );
    if (!object.Body) { throw new Error("S3 object body is empty.")}
    const content = await object.Body.transformToString();
    return normalizeSiteData(JSON.parse(content) as AssociationData);
  } catch {
    const seedData = await readDefaultLocalData();
    try {
      await writeSiteData(seedData);
    } catch {
      // S3 may be unavailable in build/deploy environments; keep local fallback.
    }
    return seedData;
  }
}

export async function writeSiteData(data: AssociationData): Promise<void> {
  const normalizedData = normalizeSiteData(data);
  const { bucketName, siteDataKey } = requireBucketConfig();
  const s3 = createS3Client();
  await s3.send( new PutObjectCommand({ Bucket: bucketName, Key: siteDataKey, Body: JSON.stringify(normalizedData, null, 2), ContentType: "application/json; charset=utf-8",}));
}

"use client";

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.84;
const MAX_OUTPUT_BYTES = 4.5 * 1024 * 1024;

const PASSTHROUGH_TYPES = new Set(["image/gif"]);

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image illisible par le navigateur."));
    };
    image.src = objectUrl;
  });
}

/**
 * Prépare une image avant l'envoi : redimensionne les photos trop grandes et
 * convertit les formats que le serveur n'accepte pas (ex. HEIC d'iPhone).
 * Les PNG et GIF sont conservés tels quels lorsqu'ils restent sous la limite,
 * afin de préserver la transparence du tampon de l'association.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || PASSTHROUGH_TYPES.has(file.type)) {
    return file;
  }
  if (file.type === "image/png" && file.size <= MAX_OUTPUT_BYTES) {
    return file;
  }

  let image: HTMLImageElement;
  try {
    image = await loadImageElement(file);
  } catch {
    // Le navigateur ne sait pas décoder ce format : on laisse le serveur
    // répondre avec un message clair plutôt que d'échouer silencieusement.
    return file;
  }

  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestSide > MAX_DIMENSION ? MAX_DIMENSION / longestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;

  // Fond blanc : évite un fond noir si un PNG transparent est converti en JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });
  if (!blob) return file;

  const alreadySmaller =
    scale === 1 && file.type === "image/jpeg" && blob.size >= file.size;
  if (alreadySmaller) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function readJsonSafely<T>(response: Response): Promise<{
  payload: T | null;
  error: string;
}> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    return { payload: null, error: "Réponse illisible du serveur." };
  }
  if (!text.trim()) {
    return {
      payload: null,
      error: response.ok ? "Réponse vide du serveur." : "Le serveur n'a pas renvoyé de message.",
    };
  }
  try {
    return { payload: JSON.parse(text) as T, error: "" };
  } catch {
    return {
      payload: null,
      error: response.ok
        ? "Réponse du serveur invalide."
        : "Le serveur a renvoyé une erreur inattendue. Réessayez.",
    };
  }
}

/** Envoie une image vers l'API et renvoie son URL publique. */
export async function uploadSiteImage(file: File): Promise<string> {
  const prepared = await prepareImageForUpload(file);
  const formData = new FormData();
  formData.append("file", prepared);

  let response: Response;
  try {
    response = await fetch("/api/admin/site-image", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "Connexion interrompue pendant l'envoi. Vérifiez votre réseau et réessayez.",
    );
  }

  const { payload, error } = await readJsonSafely<{ url?: string; message?: string }>(response);
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.message ?? error ?? "Envoi impossible.");
  }
  return payload.url;
}

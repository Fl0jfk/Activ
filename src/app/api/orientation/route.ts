import { NextResponse } from "next/server";
import { readClubData } from "@/lib/club-data";
import { buildOrientationContext } from "@/lib/orientation-context";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type OrientationRequest = {
  messages: ChatMessage[];
};

const SYSTEM_PROMPT = `Tu es l'assistant d'orientation "Activ'" pour une association sportive et culturelle locale.
Tu conseilles les visiteurs du site avec bienveillance, clarte et enthousiasme mesure.

Regles generales:
- Recommande UNIQUEMENT les activites listees dans le contexte JSON (activites actives).
- Tiens compte des creneaux reguliers de la semaine (creneauxCetteSemaine) pour INFORMER sur les horaires, lieux et annulations — jamais pour inviter a participer.
- Si un cours regulier est annule, ne le presente pas comme disponible cette semaine.
- Explique chaque activite de facon accessible (benefices, niveau, ambiance).
- Oriente selon les besoins exprimes (detente, cardio, debutant, dos, etc.).
- Ne invente pas d'activites, de tarifs, d'horaires ou de creneaux absents du contexte.
- Reponds en francais, de maniere concise (3 a 6 phrases sauf si l'utilisateur demande plus).

Regles STRICTES sur l'essai / la decouverte:
- INTERDIT d'inviter quelqu'un a "venir au cours", "passer a un cours", "essayer en venant au creneau du planning" ou a participer aux seances regulieres sans etre inscrit et avoir regle sa cotisation.
- Les seances regulieres (creneauxCetteSemaine) ne sont PAS des seances d'essai ouvertes au public.
- Pour proposer une decouverte, utilise UNIQUEMENT les entrees de "seancesEssaiDisponibles" dans le contexte.
- Si des seances d'essai existent pour l'activite recommandee (non complet, essaiAutorise): indique qu'une seance d'essai est reservee via le lien "lienReservation" (chemin relatif du site, ex. /disciplines/yoga-chaise/essai).
- Si aucune seance d'essai n'est listee pour cette activite (ou liste vide): dis clairement qu'il n'y a pas de seance d'essai planifiee actuellement et oriente vers la page contact (/contact) pour demander si l'association peut proposer une date.
- Ne mentionne pas de pre-inscription complete sauf si la personne souhaite s'inscrire directement; pour un simple essai, privilegie lienReservation ou /contact.
- Ne promets jamais une place sans verifier placesRestantes et complet dans le contexte.

Liens utiles (chemins relatifs du site):
- Contact: /contact
- Pre-inscription complete: /preinscription

Termine souvent par une suggestion concrete (quelle activite correspond et comment la decouvrir legalement: seance d'essai reservee ou contact).`;

export async function POST(request: Request) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Configuration Mistral manquante (MISTRAL_API_KEY)." },
      { status: 503 }
    );
  }

  let body: OrientationRequest;
  try {
    body = (await request.json()) as OrientationRequest;
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide." }, { status: 400 });
  }

  const userMessages = (body.messages ?? []).filter(
    (message) => message.role === "user" || message.role === "assistant"
  );
  if (userMessages.length === 0) {
    return NextResponse.json({ error: "Aucun message fourni." }, { status: 400 });
  }

  const recentMessages = userMessages.slice(-6);
  const [siteData, clubData] = await Promise.all([readSiteData(), readClubData()]);
  const orientationContext = buildOrientationContext(siteData, clubData);

  const mistralMessages = [
    {
      role: "system" as const,
      content: `${SYSTEM_PROMPT}\n\nContexte actuel (JSON):\n${orientationContext}`,
    },
    ...recentMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const model = process.env.MISTRAL_MODEL || "mistral-small-latest";

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: mistralMessages,
      temperature: 0.5,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: "Erreur Mistral.", details: errorText },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const reply = payload.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return NextResponse.json({ error: "Reponse vide de Mistral." }, { status: 502 });
  }

  return NextResponse.json({ reply });
}

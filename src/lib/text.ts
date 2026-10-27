/**
 * Limite un texte à un nombre de phrases, pour les aperçus en carte.
 * La ponctuation finale est conservée et une ellipse signale la suite.
 */
export function limitSentences(text: string, maxSentences = 3): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const sentences = normalized.match(/[^.!?…]+[.!?…]+[»”"')]*|[^.!?…]+$/g);
  if (!sentences || sentences.length <= maxSentences) {
    return normalized;
  }

  const excerpt = sentences
    .slice(0, maxSentences)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return `${excerpt} …`;
}

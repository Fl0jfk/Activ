/**
 * Modifie les paramètres de l’adresse courante sans recharger ni relancer le serveur :
 * un tableau filtré reste ainsi partageable (lien en favori) et `useSearchParams` est mis à jour.
 */
export function replaceUrlParams(update: (params: URLSearchParams) => void): void {
  const url = new URL(window.location.href);
  update(url.searchParams);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

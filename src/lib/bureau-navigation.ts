/** Recharge la page en restant sur la section dossiers du cockpit. */
export function reloadAtBureauDossiers(): void {
  if (window.location.hash !== "#dossiers") {
    window.location.hash = "dossiers";
  }
  window.location.reload();
}

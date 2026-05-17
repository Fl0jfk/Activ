export function parseClerkError(error: unknown): { message: string; status: number } {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown[] }).errors)
  ) {
    const first = (error as { errors: Array<{ code?: string; message?: string }> }).errors[0];
    const code = first?.code;
    if (code === "form_identifier_exists") {
      return {
        message: "Cette adresse email est deja utilisee. Connecte-toi ou utilise une autre adresse.",
        status: 409,
      };
    }
    if (code === "form_password_pwned") {
      return { message: "Ce mot de passe n'est pas assez securise. Choisis-en un autre.", status: 400 };
    }
    if (code === "form_password_length_too_short") {
      return { message: "Le mot de passe doit contenir au moins 8 caracteres.", status: 400 };
    }
    if (first?.message) {
      return { message: first.message, status: 400 };
    }
  }
  return { message: "Erreur serveur.", status: 500 };
}

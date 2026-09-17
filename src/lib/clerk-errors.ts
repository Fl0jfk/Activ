export function parseClerkError(error: unknown): { message: string; status: number } {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown[] }).errors)
  ) {
    const first = (error as {
      errors: Array<{ code?: string; message?: string; longMessage?: string; long_message?: string; meta?: { paramName?: string; name?: string } }>;
    }).errors[0];
    const code = first?.code;
    const param = first?.meta?.paramName ?? first?.meta?.name ?? "";

    if (code === "form_identifier_exists") {
      return {
        message:
          "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.",
        status: 409,
      };
    }
    if (code === "form_password_pwned") {
      return {
        message: "Ce mot de passe n'est pas assez sécurisé. Choisissez-en un autre.",
        status: 400,
      };
    }
    if (code === "form_password_length_too_short") {
      return { message: "Le mot de passe doit contenir au moins 8 caractères.", status: 400 };
    }
    if (code === "form_password_not_strong_enough") {
      return {
        message:
          "Mot de passe trop faible. Utilisez au moins 8 caractères, avec lettres et chiffres.",
        status: 400,
      };
    }
    if (code === "form_password_size_in_bytes_exceeded") {
      return { message: "Mot de passe trop long. Choisissez-en un plus court.", status: 400 };
    }
    if (code === "form_password_validation_failed") {
      return {
        message: "Le mot de passe ne respecte pas les règles de sécurité requises.",
        status: 400,
      };
    }
    if (code === "form_param_format_invalid") {
      if (/email/i.test(param) || /email/i.test(first?.longMessage ?? first?.long_message ?? "")) {
        return { message: "Adresse e-mail invalide.", status: 400 };
      }
      if (/password/i.test(param)) {
        return {
          message: "Le mot de passe ne respecte pas le format attendu. Essayez-en un autre.",
          status: 400,
        };
      }
      return {
        message: "Une information du formulaire a un format invalide. Vérifiez e-mail et mot de passe.",
        status: 400,
      };
    }

    const long =
      first?.longMessage?.trim() ||
      first?.long_message?.trim() ||
      first?.message?.trim();
    if (long) {
      return { message: long, status: 400 };
    }
  }
  return { message: "Erreur serveur.", status: 500 };
}

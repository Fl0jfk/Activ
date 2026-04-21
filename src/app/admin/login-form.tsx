"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "activ_admin_password";

export default function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    const response = await fetch("/api/admin/site-data", {
      headers: { "x-admin-password": password },
    });

    if (!response.ok) {
      setMessage("Mot de passe invalide.");
      setIsLoading(false);
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, password);
    router.push("/admin/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-20 w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Connexion administration</h1>
      <p className="mt-2 text-sm text-slate-600">Entrez le mot de passe admin pour acceder au tableau de bord.</p>
      <label className="mt-5 block text-sm font-semibold text-slate-700">Mot de passe</label>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
      />
      <button
        type="submit"
        disabled={isLoading || password.length === 0}
        className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        Se connecter
      </button>
      {message ? <p className="mt-3 text-sm font-medium text-red-700">{message}</p> : null}
    </form>
  );
}

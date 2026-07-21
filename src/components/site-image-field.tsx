"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type SiteImageFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  helpText?: string;
  /** Valeur après « Retirer ». Défaut : /logo.png */
  emptyValue?: string;
};

export default function SiteImageField({
  label,
  value,
  onChange,
  disabled = false,
  helpText,
  emptyValue = "/logo.png",
}: SiteImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/site-image", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.message ?? "Envoi impossible.");
      }
      onChange(payload.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Envoi impossible.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
      <span>{label}</span>
      {helpText ? <p className="text-xs font-normal text-slate-500">{helpText}</p> : null}
      {value ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <Image
            src={value}
            alt={label}
            width={640}
            height={320}
            unoptimized
            className="h-40 w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs font-normal text-slate-500">
          Aucune image sélectionnée
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={disabled || isUploading}
          onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
          className="block w-full max-w-md text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-50"
        />
        {value && value !== emptyValue ? (
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => onChange(emptyValue)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Retirer
          </button>
        ) : null}
      </div>
      {isUploading ? <p className="text-xs font-normal text-cyan-700">Envoi de l&apos;image…</p> : null}
      {error ? <p className="text-xs font-normal text-rose-600">{error}</p> : null}
    </div>
  );
}

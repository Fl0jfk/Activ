import type { ReactNode } from "react";

type ChoiceCardProps = {
  type: "checkbox" | "radio";
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Identifiant de l'élément (ex. message d'erreur) qui décrit ce choix. */
  describedBy?: string;
  id?: string;
  value?: string;
  children: ReactNode;
};

/** Case à cocher ou bouton radio présenté comme une grande carte cliquable (≥ 56 px de haut). */
export default function ChoiceCard({
  type,
  name,
  checked,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
  id,
  value,
  children,
}: ChoiceCardProps) {
  const border = checked
    ? "border-brand-blue bg-brand-blue/5"
    : invalid
      ? "border-rose-400 bg-rose-50/40"
      : "border-brand-line bg-white hover:border-brand-blue/50";
  return (
    <label
      className={`flex min-h-14 items-start gap-3.5 rounded-2xl border-2 p-4 transition focus-within:ring-2 focus-within:ring-brand-blue/40 ${border} ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-6 w-6 shrink-0 accent-brand-blue"
      />
      <span className="min-w-0 flex-1 text-[15px] leading-6 text-slate-800">{children}</span>
    </label>
  );
}

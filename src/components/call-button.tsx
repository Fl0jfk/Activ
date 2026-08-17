import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";

type CallButtonProps = {
  className?: string;
  label?: string;
  compact?: boolean;
};

export default function CallButton({
  className = "",
  label,
  compact = false,
}: CallButtonProps) {
  const text = label ?? (compact ? "Appeler" : ASSOCIATION_PHONE_DISPLAY);

  return (
    <a
      href={ASSOCIATION_PHONE_TEL}
      aria-label={`Appeler ${ASSOCIATION_PHONE_DISPLAY}`}
      className={
        className ||
        (compact
          ? "inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-emerald-500"
          : "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-500")
      }
    >
      <span aria-hidden>☎</span>
      <span>{text}</span>
    </a>
  );
}

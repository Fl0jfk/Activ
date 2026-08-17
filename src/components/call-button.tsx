import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";

type CallButtonProps = {
  className?: string;
};

export default function CallButton({ className = "" }: CallButtonProps) {
  return (
    <a
      href={ASSOCIATION_PHONE_TEL}
      aria-label={`Appeler ${ASSOCIATION_PHONE_DISPLAY}`}
      title={`Appeler ${ASSOCIATION_PHONE_DISPLAY}`}
      className={
        className ||
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#34C759] text-white transition hover:-translate-y-0.5 hover:bg-[#30D158]"
      }
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="currentColor">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C9.61 21 2 13.39 2 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
      </svg>
    </a>
  );
}

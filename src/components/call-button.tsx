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
      <svg viewBox="0 0 24 24" aria-hidden className="h-[22px] w-[22px]" fill="currentColor">
        <g transform="rotate(-40 12 12)">
          <rect x="6.4" y="2.1" width="11.2" height="6.3" rx="3.15" />
          <rect x="8.55" y="7.2" width="6.9" height="9.6" rx="2.45" />
          <rect x="6.4" y="15.6" width="11.2" height="6.3" rx="3.15" />
        </g>
      </svg>
    </a>
  );
}

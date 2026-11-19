type FacebookButtonProps = {
  href: string;
  className?: string;
  label?: string;
  onClick?: () => void;
};

export default function FacebookButton({ href, className = "", label, onClick }: FacebookButtonProps) {
  const defaultClassName = label
    ? "inline-flex shrink-0 items-center gap-2.5 rounded-full bg-[#1877F2] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#166FE5]"
    : "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-white transition hover:-translate-y-0.5 hover:bg-[#166FE5]";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label ?? "Page Facebook"}
      title="Page Facebook"
      onClick={onClick}
      className={className || defaultClassName}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="currentColor">
        <path d="M14.26 2A26.11 26.11 0 0 1 17 2.14V5.32h-1.88c-1.45 0-1.73.67-1.73 1.73v2.27h3.52l-.46 3.56h-3.06V22h-3.68v-9.12h-3.1V9.32h3.1V6.7C9.71 3.66 11.54 2 14.26 2Z" />
      </svg>
      {label ? <span>{label}</span> : null}
    </a>
  );
}

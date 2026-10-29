import { cn } from "@/lib/cn";
import { formatWhatsApp, whatsappUrl } from "@/lib/whatsapp";

/** The WhatsApp glyph (for a click-to-chat link). */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn("size-4 shrink-0", className)}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35M12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.46-9.45 2.52 0 4.9.99 6.68 2.77a9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.46 9.45m8.05-17.5A11.32 11.32 0 0 0 12.05.67C5.78.67.67 5.78.67 12.06c0 2 .52 3.96 1.52 5.69L.57 23.67l6.05-1.59a11.36 11.36 0 0 0 5.43 1.38h.01c6.27 0 11.38-5.11 11.38-11.39 0-3.04-1.18-5.9-3.34-8.06" />
    </svg>
  );
}

type Variant = "pill" | "button" | "inline";

const styles: Record<Variant, string> = {
  // Soft pink chip: contact details, footer, shipping info.
  pill: "inline-flex items-center gap-2 rounded-full border border-rose/30 bg-blush px-3.5 py-1.5 text-sm font-semibold text-rose-deep shadow-[0_1px_0_rgba(217,79,145,0.08)] transition hover:-translate-y-px hover:border-rose hover:bg-rose hover:text-white hover:shadow-[0_8px_20px_-10px_rgba(217,79,145,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose",
  // Main call to action.
  button: "inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-rose to-rose-deep px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_12px_28px_-12px_rgba(184,53,122,0.9)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-12px_rgba(184,53,122,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose sm:w-auto",
  // Inside a sentence.
  inline: "inline-flex items-center gap-1 font-semibold text-rose-deep underline decoration-rose/40 underline-offset-4 transition hover:text-rose hover:decoration-rose",
};

/**
 * Pink click-to-chat link that opens WhatsApp with the store. Renders nothing when the
 * number is missing or invalid, so pages never show a broken link.
 */
export function WhatsAppLink({
  number,
  message,
  label,
  variant = "pill",
  showNumber = false,
  className,
  tone,
}: {
  number: string | null | undefined;
  message?: string;
  label?: string;
  variant?: Variant;
  showNumber?: boolean;
  className?: string;
  /** "light" for dark backgrounds (footer). */
  tone?: "light";
}) {
  const href = whatsappUrl(number, message);
  if (!href) return null;
  const text = label ?? (showNumber ? formatWhatsApp(number) : "Chat on WhatsApp");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(styles[variant], tone === "light" && variant === "pill" && "border-rose-light/40 bg-white/5 text-rose-light hover:bg-rose hover:text-white", className)}
      aria-label={`${text} (opens WhatsApp)`}
    >
      <WhatsAppIcon className={variant === "button" ? "size-5" : undefined} />
      <span>{text}</span>
    </a>
  );
}

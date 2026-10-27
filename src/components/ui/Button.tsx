import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "rose" | "outline" | "ghost" | "light";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-plum text-white hover:bg-rose-deep",
  rose: "bg-rose-deep text-white hover:bg-plum",
  outline: "border border-plum text-plum hover:bg-plum hover:text-white",
  ghost: "text-plum hover:bg-blush",
  light: "bg-white text-plum hover:bg-blush",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.7rem]",
  md: "h-12 px-7 text-[0.72rem]",
  lg: "h-14 px-9 text-xs",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[2px] font-sans font-bold uppercase tracking-[0.2em]",
    "transition-[background-color,color,border-color,transform] duration-300 ease-[var(--ease-luxe)] active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClasses(variant, size, className)} aria-busy={loading || undefined} {...props}>
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...rest}>
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

import Link from "next/link";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && <Link href={back.href} className="text-xs text-muted hover:text-plum">← {back.label}</Link>}
        <h1 className="display mt-1 text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, children, className, actions }: { title?: string; description?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 border border-line bg-white p-5 sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-1 text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="font-medium">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "rose" | "success" | "warning" | "danger" | "plum" }) {
  const styles = {
    neutral: "bg-neutral text-plum-soft border-line",
    rose: "bg-pale text-rose-deep border-pale",
    success: "bg-[#eaf6ef] text-success border-[#cfe9da]",
    warning: "bg-[#fff6e0] text-warning border-[#f3e0b0]",
    danger: "bg-[#fdecef] text-danger border-[#f5c9d0]",
    plum: "bg-plum text-white border-plum",
  }[tone];
  return <span className={cn("inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.1em]", styles)}>{children}</span>;
}

export function Table({ children, fit = false }: { children: React.ReactNode; fit?: boolean }) {
  return (
    <div className="overflow-x-auto border border-line bg-white">
      <table className={cn("w-full text-sm", !fit && "min-w-[40rem]", "[&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-[0.65rem] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-muted [&_thead]:border-b [&_thead]:border-line [&_tbody_tr]:border-b [&_tbody_tr]:border-line last:[&_tbody_tr]:border-0 [&_tbody_tr:hover]:bg-neutral/60")}>
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed border-line bg-white p-10 text-center text-sm text-muted">{children}</div>;
}

export const inputCls = "field !py-2 !text-sm";

import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "error" | "success"; title?: string; children?: React.ReactNode; className?: string }) {
  const styles = {
    info: "border-line bg-neutral text-plum",
    warning: "border-[#f0d9a8] bg-[#fff8e8] text-[#6b4a00]",
    error: "border-[#f2c4cb] bg-[#fff1f3] text-danger",
    success: "border-[#bfe0cd] bg-[#f0faf4] text-success",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 border px-4 py-3 text-sm", styles, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "leading-relaxed")}>{children}</div>}
      </div>
    </div>
  );
}

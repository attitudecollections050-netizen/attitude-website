import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Pagination({ page, pageCount, basePath, params }: { page: number; pageCount: number; basePath: string; params: URLSearchParams }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(params);
    if (p > 1) q.set("page", String(p));
    else q.delete("page");
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link href={href(page - 1)} className="grid size-10 place-items-center hover:text-rose-deep" aria-label="Previous page" rel="prev">
          <ChevronLeft className="size-4" />
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn("grid size-10 place-items-center text-sm tabular-nums transition", p === page ? "bg-plum text-white" : "hover:bg-blush")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link href={href(page + 1)} className="grid size-10 place-items-center hover:text-rose-deep" aria-label="Next page" rel="next">
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  );
}

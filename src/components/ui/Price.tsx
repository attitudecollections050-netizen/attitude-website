import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

export function Price({ price, salePrice, className, size = "md" }: { price: number; salePrice?: number | null; className?: string; size?: "sm" | "md" | "lg" }) {
  const onSale = salePrice != null && salePrice < price;
  const text = size === "lg" ? "text-xl" : size === "sm" ? "text-[0.8rem]" : "text-sm";
  return (
    <span className={cn("inline-flex items-baseline gap-2 font-sans tabular-nums", text, className)}>
      {onSale ? (
        <>
          <span className="font-semibold text-rose-deep">
            <span className="sr-only">Sale price </span>
            {formatMoney(salePrice!)}
          </span>
          <s className="text-muted">
            <span className="sr-only">Original price </span>
            {formatMoney(price)}
          </s>
        </>
      ) : (
        <span className="font-semibold">{formatMoney(price)}</span>
      )}
    </span>
  );
}

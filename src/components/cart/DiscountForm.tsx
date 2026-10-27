"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { useCart } from "./CartProvider";

export function DiscountForm() {
  const { cart, applyCode, removeCode, pending } = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (cart.discount) {
    return (
      <div className="flex items-center justify-between rounded-full bg-pale px-4 py-2 text-sm">
        <span>
          <span className="font-semibold">{cart.discount.code}</span> · {cart.discount.label}
        </span>
        <button type="button" onClick={() => removeCode()} disabled={pending} className="p-1 hover:text-rose-deep" aria-label="Remove discount code">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const r = await applyCode(code);
        if (!r.ok) setError(r.error);
        else setCode("");
      }}
    >
      <label htmlFor="discount-code" className="text-xs text-muted">
        Discount code
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="discount-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="field !py-2.5 uppercase"
          autoComplete="off"
          maxLength={32}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "discount-error" : undefined}
        />
        <button type="submit" disabled={pending || code.trim().length < 3} className="shrink-0 rounded-full border border-plum px-5 text-[0.68rem] font-bold uppercase tracking-[0.18em] transition hover:bg-plum hover:text-white disabled:opacity-40">
          Apply
        </button>
      </div>
      {(error || cart.discountError) && (
        <p id="discount-error" className="mt-1.5 text-xs text-danger" role="alert">
          {error ?? cart.discountError}
        </p>
      )}
    </form>
  );
}

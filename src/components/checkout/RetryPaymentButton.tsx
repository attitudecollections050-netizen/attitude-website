"use client";
import { useState } from "react";
import { retryPayment } from "@/app/actions/checkout";
import { Button } from "@/components/ui/Button";

export function RetryPaymentButton({ orderNumber, token }: { orderNumber: string; token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        loading={pending}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const r = await retryPayment(orderNumber, token);
          if (r.ok) window.location.assign(r.redirectUrl);
          else {
            setPending(false);
            setError(r.error);
          }
        }}
      >
        Try payment again
      </Button>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

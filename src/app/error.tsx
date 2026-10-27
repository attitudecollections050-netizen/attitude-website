"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button, buttonClasses } from "@/components/ui/Button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-blush px-4 text-center">
      <Link href="/" aria-label="Home"><Wordmark /></Link>
      <h1 className="display text-4xl sm:text-5xl">Something went wrong.</h1>
      <p className="max-w-md text-sm text-plum-soft">
        We couldn&apos;t load this page. Please try again. {error.digest && <span className="block pt-2 text-xs text-muted">Reference: {error.digest}</span>}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonClasses("outline")}>Back home</Link>
      </div>
    </div>
  );
}

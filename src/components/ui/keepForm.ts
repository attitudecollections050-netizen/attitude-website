"use client";
import { startTransition } from "react";

/**
 * React 19 resets a <form action> after every submission, wiping what the
 * user typed even when validation fails. Submitting through this handler runs
 * the same action without the automatic reset (the action prop remains as the
 * no-JavaScript fallback).
 */
export function keepValues(action: (formData: FormData) => void, before?: (e: React.FormEvent<HTMLFormElement>) => boolean) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (before && !before(e)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => action(formData));
  };
}

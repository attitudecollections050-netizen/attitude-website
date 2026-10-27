import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-blush px-4 text-center">
      <Link href="/" aria-label="Home"><Wordmark /></Link>
      <p className="display text-[7rem] leading-none text-rose sm:text-[10rem]">404</p>
      <h1 className="display text-4xl sm:text-5xl">This page has left the runway.</h1>
      <p className="max-w-md text-sm text-plum-soft">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses("primary")}>Back home</Link>
        <Link href="/shop" className={buttonClasses("outline")}>Shop all</Link>
      </div>
    </div>
  );
}

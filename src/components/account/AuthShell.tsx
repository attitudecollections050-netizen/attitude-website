import { getTranslations } from "next-intl/server";
import { Monogram } from "@/components/brand/Wordmark";

export async function AuthShell({ eyebrow, title, children, footer }: { eyebrow: string; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const t = await getTranslations("account");
  return (
    <div className="grid min-h-[70vh] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-plum lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(217,79,145,0.45),transparent_55%),radial-gradient(circle_at_80%_90%,rgba(251,228,238,0.25),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <Monogram className="size-20" />
          <p className="display max-w-md text-6xl">
            {t.rich("tagline", { em: (c) => <span className="italic text-pale">{c}</span> })}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-16 sm:px-10">
        <div className="w-full max-w-md">
          <p className="eyebrow text-rose-deep">{eyebrow}</p>
          <h1 className="display mt-3 text-5xl">{title}</h1>
          <div className="mt-10">{children}</div>
          {footer && <div className="mt-8 border-t border-line pt-6 text-sm text-plum-soft">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

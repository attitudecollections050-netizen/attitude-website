import Link from "next/link";

export function AnnouncementBar({ text, href }: { text: string; href: string | null }) {
  if (!text) return null;
  const content = <span className="eyebrow !tracking-[0.2em] text-[0.62rem] sm:text-[0.66rem]">{text}</span>;
  return (
    <div className="bg-plum text-white">
      <div className="container-luxe flex min-h-9 items-center justify-center py-2 text-center">
        {href ? (
          <Link href={href} className="link-underline">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

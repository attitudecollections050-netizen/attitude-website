import Link from "next/link";
import { Fragment } from "react";
import { normalizeWhatsApp } from "@/lib/whatsapp";
import { WhatsAppLink } from "./WhatsAppLink";

/**
 * Minimal, safe markdown renderer for admin-edited pages: headings, paragraphs,
 * lists, **bold**, [links](/path) and [placeholders]. No raw HTML is rendered.
 */
/** Matches the store's WhatsApp number as written in page text (+234 803…, 0803…, with or without spaces). */
function whatsappPattern(number: string | null | undefined): string | null {
  const n = normalizeWhatsApp(number);
  if (!n) return null;
  const spaced = (d: string) => d.split("").join("[\\s-]?");
  const forms = [`\\+?${spaced(n)}`];
  if (n.startsWith("234")) forms.push(spaced("0" + n.slice(3)));
  return forms.join("|");
}

/** Turns the WhatsApp number, and the word "WhatsApp", in plain text into pink chat links. */
function linkWhatsApp(text: string, keyBase: string, number: string | null | undefined): React.ReactNode[] {
  const num = whatsappPattern(number);
  if (!num) return [text];
  const re = new RegExp(`(${num})|\\b(WhatsApp)\\b`, "gi");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<WhatsAppLink key={`${keyBase}-w${i++}`} number={number} variant="inline" label={m[0]} />);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function inline(text: string, keyBase: string, whatsapp?: string | null): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(((?:\/|https:\/\/|mailto:)[^)\s]*)\)|\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...linkWhatsApp(text.slice(last, m.index), `${keyBase}-t${i}`, whatsapp));
    const key = `${keyBase}-${i++}`;
    if (m[1]) out.push(<strong key={key}>{m[1]}</strong>);
    else if (m[2] && m[3])
      out.push(
        m[3].startsWith("/") ? (
          <Link key={key} href={m[3]}>{m[2]}</Link>
        ) : (
          <a key={key} href={m[3]} rel="noopener noreferrer" target={m[3].startsWith("mailto:") ? undefined : "_blank"}>{m[2]}</a>
        ),
      );
    else if (m[4]) out.push(<span key={key} className="placeholder" title="Placeholder — edit in Admin → Content">[{m[4]}]</span>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(...linkWhatsApp(text.slice(last), `${keyBase}-end`, whatsapp));
  return out;
}

export function Markdown({ source, whatsapp }: { source: string; whatsapp?: string | null }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="prose-luxe">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        if (lines[0].startsWith("### ")) {
          return (
            <Fragment key={bi}>
              <h3>{inline(lines[0].slice(4), `h${bi}`, whatsapp)}</h3>
              {lines.length > 1 && <p>{inline(lines.slice(1).join(" "), `p${bi}`, whatsapp)}</p>}
            </Fragment>
          );
        }
        if (lines[0].startsWith("## ")) {
          return (
            <Fragment key={bi}>
              <h2>{inline(lines[0].slice(3), `h${bi}`, whatsapp)}</h2>
              {lines.length > 1 && <p>{inline(lines.slice(1).join(" "), `p${bi}`, whatsapp)}</p>}
            </Fragment>
          );
        }
        if (lines.every((l) => /^[-*] /.test(l))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.slice(2), `u${bi}${li}`, whatsapp)}</li>)}</ul>;
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return <ol key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\d+\. /, ""), `o${bi}${li}`, whatsapp)}</li>)}</ol>;
        }
        return <p key={bi}>{inline(lines.join(" "), `p${bi}`, whatsapp)}</p>;
      })}
    </div>
  );
}

import Link from "next/link";
import { Fragment } from "react";

/**
 * Minimal, safe markdown renderer for admin-edited pages: headings, paragraphs,
 * lists, **bold**, [links](/path) and [placeholders]. No raw HTML is rendered.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(((?:\/|https:\/\/|mailto:)[^)\s]*)\)|\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
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
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="prose-luxe">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        if (lines[0].startsWith("### ")) {
          return (
            <Fragment key={bi}>
              <h3>{inline(lines[0].slice(4), `h${bi}`)}</h3>
              {lines.length > 1 && <p>{inline(lines.slice(1).join(" "), `p${bi}`)}</p>}
            </Fragment>
          );
        }
        if (lines[0].startsWith("## ")) {
          return (
            <Fragment key={bi}>
              <h2>{inline(lines[0].slice(3), `h${bi}`)}</h2>
              {lines.length > 1 && <p>{inline(lines.slice(1).join(" "), `p${bi}`)}</p>}
            </Fragment>
          );
        }
        if (lines.every((l) => /^[-*] /.test(l))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.slice(2), `u${bi}${li}`)}</li>)}</ul>;
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return <ol key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\d+\. /, ""), `o${bi}${li}`)}</li>)}</ol>;
        }
        return <p key={bi}>{inline(lines.join(" "), `p${bi}`)}</p>;
      })}
    </div>
  );
}

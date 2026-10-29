// Email templates. Each returns { subject, html, text } ready for sendEmail().
// Pure functions (no I/O), so any flow can use them and they're easy to test.
// Everything that comes from a person or the database is HTML-escaped here.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "Attitude Collections";
const C = { ink: "#251923", muted: "#7a6a74", rose: "#D94F91", line: "#ece4e8" };

export function esc(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Only http(s) links go into buttons and hrefs. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

function greeting(name?: string | null): string {
  return name?.trim() ? `Hi ${name.trim()},` : "Hi,";
}

function button(url: string, label: string): string {
  return `<p style="margin:28px 0"><a href="${esc(safeUrl(url))}" style="display:inline-block;background:${C.ink};color:#ffffff;padding:13px 26px;border-radius:999px;text-decoration:none;font-weight:bold;letter-spacing:.06em">${esc(label)}</a></p>`;
}

/** Shared frame: brand header, body, small print. `preheader` is the inbox preview line. */
export function layout(body: string, opts: { preheader?: string; dir?: "ltr" | "rtl"; lang?: string; footer?: string } = {}): string {
  return `<!doctype html><html lang="${esc(opts.lang ?? "en")}" dir="${opts.dir ?? "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#ffffff">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</div>` : ""}
<div style="font-family:Arial,Helvetica,sans-serif;color:${C.ink};max-width:560px;margin:0 auto;padding:32px 20px;line-height:1.55;font-size:15px">
<p style="font-family:Georgia,serif;font-size:22px;letter-spacing:.18em;margin:0 0 28px">ATTITUDE COLLECTIONS</p>
${body}
<p style="margin-top:36px;padding-top:16px;border-top:1px solid ${C.line};color:${C.muted};font-size:12px">${opts.footer ? esc(opts.footer) : `You're receiving this email because of activity on your ${BRAND} account or order.`}</p>
</div></body></html>`;
}

// ------------------------------------------------------------------ invite
export function inviteEmail(p: { name?: string | null; role: string; link: string; storeName?: string; expiresIn?: string }): EmailContent {
  const store = p.storeName ?? BRAND;
  const expiry = p.expiresIn ? `It works once and expires in ${p.expiresIn}.` : "It works once and expires soon.";
  return {
    subject: `You're invited to the ${store} dashboard`,
    html: layout(
      `<p>${esc(greeting(p.name))}</p>
<p>You've been invited to help manage <strong>${esc(store)}</strong> as <strong>${esc(p.role)}</strong>.</p>
${button(p.link, "Accept invitation & choose your password")}
<p style="color:${C.muted};font-size:13px">${esc(expiry)} If it has expired, ask the store owner to send a new one. If you weren't expecting this, you can ignore it.</p>`,
      { preheader: `You've been invited as ${p.role}` },
    ),
    text: `${greeting(p.name)}\n\nYou've been invited to help manage ${store} as ${p.role}.\n\nAccept and choose your password: ${p.link}\n\n${expiry}`,
  };
}

// ------------------------------------------------------------ verification
export function verificationEmail(p: { name?: string | null; link: string; code?: string; expiresIn?: string }): EmailContent {
  const expiry = `This link expires in ${p.expiresIn ?? "1 hour"}.`;
  return {
    subject: `Confirm your email for ${BRAND}`,
    html: layout(
      `<p>${esc(greeting(p.name))}</p>
<p>Please confirm your email address to finish setting up your account.</p>
${button(p.link, "Confirm email")}
${p.code ? `<p>Or enter this code: <strong style="font-size:20px;letter-spacing:.2em">${esc(p.code)}</strong></p>` : ""}
<p style="color:${C.muted};font-size:13px">${esc(expiry)} If you didn't create an account, you can ignore this email.</p>`,
      { preheader: "Confirm your email address" },
    ),
    text: `${greeting(p.name)}\n\nConfirm your email address: ${p.link}${p.code ? `\nCode: ${p.code}` : ""}\n\n${expiry} If you didn't create an account, ignore this email.`,
  };
}

// ---------------------------------------------------------- password reset
export function passwordResetEmail(p: { name?: string | null; link: string; expiresIn?: string }): EmailContent {
  const expiry = `This link expires in ${p.expiresIn ?? "1 hour"} and can be used once.`;
  return {
    subject: `Reset your ${BRAND} password`,
    html: layout(
      `<p>${esc(greeting(p.name))}</p>
<p>We received a request to reset your password.</p>
${button(p.link, "Choose a new password")}
<p style="color:${C.muted};font-size:13px">${esc(expiry)} If you didn't ask for this, you can ignore this email — your password won't change.</p>`,
      { preheader: "Reset your password" },
    ),
    text: `${greeting(p.name)}\n\nReset your password: ${p.link}\n\n${expiry} If you didn't ask for this, ignore this email.`,
  };
}

// --------------------------------------------------------- receipt / invoice
export interface ReceiptLine {
  name: string;
  detail?: string | null;
  quantity: number;
  /** Already formatted, e.g. "₦42,000". */
  amount: string;
}
export interface ReceiptLabels {
  subject: string;
  greeting: string;
  heading: string;
  delivery?: string;
  total: string;
  view: string;
  track?: string;
  text: string;
}
export function receiptEmail(p: {
  orderNumber: string;
  customerName?: string | null;
  lines: ReceiptLine[];
  /** Extra rows before the total, e.g. delivery or discount (already formatted). */
  extras?: { label: string; amount: string }[];
  total: string;
  link: string;
  trackLink?: string;
  /** Translated wording; English is used when omitted. */
  labels?: Partial<ReceiptLabels>;
  dir?: "ltr" | "rtl";
  lang?: string;
}): EmailContent {
  const l: ReceiptLabels = {
    subject: `Your ${BRAND} order ${p.orderNumber}`,
    greeting: greeting(p.customerName),
    heading: `Order ${p.orderNumber}`,
    total: "Total paid",
    view: "View your order",
    track: "Track your order",
    text: `Thank you for your order ${p.orderNumber}. Total paid: ${p.total}. View it here: ${p.link}`,
    ...p.labels,
  };
  const rows = p.lines
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line}">${esc(i.name)}${i.detail ? ` <span style="color:${C.muted}">(${esc(i.detail)})</span>` : ""} × ${esc(i.quantity)}</td><td style="padding:8px 0;border-bottom:1px solid ${C.line};text-align:end;white-space:nowrap">${esc(i.amount)}</td></tr>`,
    )
    .join("");
  const extras = (p.extras ?? []).map((x) => `<tr><td style="padding-top:10px">${esc(x.label)}</td><td style="padding-top:10px;text-align:end">${esc(x.amount)}</td></tr>`).join("");
  return {
    subject: l.subject,
    html: layout(
      `<p>${esc(l.greeting)}</p>
<p><strong>${esc(l.heading)}</strong></p>
<table role="presentation" style="width:100%;border-collapse:collapse">${rows}${extras}
<tr><td style="padding-top:12px"><strong>${esc(l.total)}</strong></td><td style="padding-top:12px;text-align:end"><strong>${esc(p.total)}</strong></td></tr></table>
${button(p.link, l.view)}
${p.trackLink && l.track ? `<p><a href="${esc(safeUrl(p.trackLink))}" style="color:${C.rose}">${esc(l.track)}</a></p>` : ""}`,
      { preheader: l.heading, dir: p.dir, lang: p.lang },
    ),
    text: l.text,
  };
}

// ------------------------------------------------------------ notification
export function notificationEmail(p: { title: string; message: string; name?: string | null; actionUrl?: string; actionLabel?: string; preheader?: string }): EmailContent {
  const paragraphs = p.message.split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`).join("");
  return {
    subject: p.title,
    html: layout(
      `${p.name !== undefined ? `<p>${esc(greeting(p.name))}</p>` : ""}
<p style="font-size:18px"><strong>${esc(p.title)}</strong></p>
${paragraphs}
${p.actionUrl ? button(p.actionUrl, p.actionLabel ?? "Open") : ""}`,
      { preheader: p.preheader ?? p.title },
    ),
    text: `${p.name !== undefined ? `${greeting(p.name)}\n\n` : ""}${p.title}\n\n${p.message}${p.actionUrl ? `\n\n${p.actionLabel ?? "Open"}: ${p.actionUrl}` : ""}`,
  };
}

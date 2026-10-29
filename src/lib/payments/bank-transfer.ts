// Manual bank transfer: settings check and the wording of WhatsApp messages.
import type { StoreSettings } from "@/lib/settings";

export type BankTransferSettings = StoreSettings["bank_transfer"];

/** Bank transfer is offered when it's switched on and the bank details are complete. */
export function bankTransferActive(b: BankTransferSettings | undefined): boolean {
  return Boolean(b?.enabled && b.bank_name?.trim() && b.account_name?.trim() && /^\d{10}$/.test(b.account_number ?? ""));
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

interface ClaimInfo {
  name: string;
  orderNumber: string;
  amountKobo: number;
  reference: string;
  whatsapp?: string;
}

/** What the customer sends us on WhatsApp after submitting the form. */
export function customerPaidMessage(c: ClaimInfo & { storeName: string }): string {
  return [
    `Hello ${c.storeName}! I've just paid for my order ${c.orderNumber}.`,
    ``,
    `Name: ${c.name}`,
    `Amount: ${naira(c.amountKobo)}`,
    `Reference: ${c.reference}`,
    c.whatsapp ? `My WhatsApp: ${c.whatsapp}` : "",
  ]
    .filter((l, i, a) => l !== "" || i < a.length - 1)
    .join("\n")
    .trim();
}

/** What the owner sends the customer after confirming the transfer. */
export function paymentConfirmedMessage(c: ClaimInfo & { storeName: string; orderUrl: string }): string {
  return [
    `Hi ${c.name.split(" ")[0]}! ✅ Payment confirmed.`,
    ``,
    `We've received your payment of ${naira(c.amountKobo)} (reference ${c.reference}) for order ${c.orderNumber}. We're now getting your order ready.`,
    ``,
    `You can follow it here: ${c.orderUrl}`,
    ``,
    `Thank you for shopping with ${c.storeName}! 💕`,
  ].join("\n");
}

/** What the owner sends when the transfer can't be found. */
export function paymentNotFoundMessage(c: ClaimInfo & { storeName: string; transferUrl: string; phone?: string | null }): string {
  return [
    `Hi ${c.name.split(" ")[0]}, thank you for your order ${c.orderNumber}.`,
    ``,
    `We couldn't find a payment with reference ${c.reference} yet. Please double-check the reference and submit it again here: ${c.transferUrl}`,
    ``,
    `You can also reply with a screenshot of your transfer receipt${c.phone ? ` or call us on ${c.phone}` : ""} and we'll sort it out quickly.`,
    ``,
    `— ${c.storeName}`,
  ].join("\n");
}

import { describe, expect, it } from "vitest";
import { formatWhatsApp, normalizeWhatsApp, whatsappUrl } from "@/lib/whatsapp";
import { bankTransferActive, customerPaidMessage, paymentConfirmedMessage, paymentNotFoundMessage } from "@/lib/payments/bank-transfer";

describe("WhatsApp links", () => {
  it("normalises Nigerian and international numbers", () => {
    expect(normalizeWhatsApp("0803 123 4567")).toBe("2348031234567");
    expect(normalizeWhatsApp("+234 803-123-4567")).toBe("2348031234567");
    expect(normalizeWhatsApp("002348031234567")).toBe("2348031234567");
    expect(normalizeWhatsApp("+44 7700 900123")).toBe("447700900123");
    expect(normalizeWhatsApp("call me")).toBeNull();
    expect(normalizeWhatsApp("")).toBeNull();
    expect(normalizeWhatsApp(null)).toBeNull();
  });
  it("builds wa.me links with an encoded message", () => {
    expect(whatsappUrl("08031234567")).toBe("https://wa.me/2348031234567");
    expect(whatsappUrl("08031234567", "Hi & thanks? ₦5,000")).toBe("https://wa.me/2348031234567?text=Hi%20%26%20thanks%3F%20%E2%82%A65%2C000");
    expect(whatsappUrl(null, "x")).toBeNull();
    expect(formatWhatsApp("08031234567")).toBe("+234 803 123 4567");
  });
});

describe("bank transfer", () => {
  const ok = { enabled: true, bank_name: "First Bank", account_name: "OKONYE JUSTICE JESSICA", account_number: "3043027979", note: "" };
  it("is active only when switched on with complete details", () => {
    expect(bankTransferActive(ok)).toBe(true);
    expect(bankTransferActive({ ...ok, enabled: false })).toBe(false);
    expect(bankTransferActive({ ...ok, account_number: "12345" })).toBe(false);
    expect(bankTransferActive({ ...ok, account_name: " " })).toBe(false);
    expect(bankTransferActive(undefined)).toBe(false);
  });
  it("writes friendly, complete WhatsApp messages", () => {
    const base = { name: "Ada Obi", orderNumber: "AC100050", amountKobo: 4750000, reference: "FT123456789", storeName: "Attitude Collections" };
    const paid = customerPaidMessage({ ...base, whatsapp: "0803 123 4567" });
    expect(paid).toContain("I've just paid for my order AC100050");
    expect(paid).toContain("Amount: ₦47,500");
    expect(paid).toContain("Reference: FT123456789");
    expect(paid).toContain("My WhatsApp: 0803 123 4567");
    const yes = paymentConfirmedMessage({ ...base, orderUrl: "https://shop.example/order/AC100050?token=x" });
    expect(yes).toMatch(/^Hi Ada! ✅ Payment confirmed\./);
    expect(yes).toContain("₦47,500 (reference FT123456789)");
    expect(yes).toContain("https://shop.example/order/AC100050?token=x");
    const no = paymentNotFoundMessage({ ...base, transferUrl: "https://shop.example/checkout/transfer/AC100050?token=x", phone: "+234 803 123 4567" });
    expect(no).toContain("couldn't find a payment with reference FT123456789");
    expect(no).toContain("call us on +234 803 123 4567");
    expect(no).not.toMatch(/dey|abeg|don enter/i);
  });
});

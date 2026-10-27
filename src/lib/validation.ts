import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number, including country code for international numbers.");

export const addressSchema = z.object({
  full_name: trimmed(120).min(2, "Enter the recipient's full name."),
  phone: phoneSchema,
  country_code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Choose a country."),
  region: trimmed(100),
  city: trimmed(100).min(1, "Enter your city or town."),
  line1: trimmed(200).min(3, "Enter your street address."),
  line2: trimmed(200).optional().default(""),
  postal_code: trimmed(20).optional().default(""),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({
  email: emailSchema,
  address: addressSchema,
  delivery_instructions: trimmed(500).optional().default(""),
  shipping_rate_id: z.string().uuid("Choose a delivery method."),
  nonce: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
  save_address: z.boolean().optional().default(false),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const contactSchema = z.object({
  name: trimmed(120).min(1, "Enter your name."),
  email: emailSchema,
  order_number: trimmed(30).optional().default(""),
  subject: trimmed(160).min(1, "Enter a subject."),
  message: trimmed(5000).min(10, "Your message should be at least 10 characters."),
  website: z.string().max(0).optional().default(""), // honeypot
});

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72)
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const registerSchema = z.object({
  full_name: trimmed(120).min(2, "Enter your name."),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(72),
});

export function safeNextPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

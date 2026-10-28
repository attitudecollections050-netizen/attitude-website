import "server-only";
import { cookies } from "next/headers";
import { CONSENT_COOKIE, VISITOR_COOKIE, isUuid } from "./shared";

/** The visitor id, only when the visitor has accepted analytics cookies. */
export async function consentedVisitorId(): Promise<string | null> {
  const jar = await cookies();
  if (jar.get(CONSENT_COOKIE)?.value !== "granted") return null;
  const id = jar.get(VISITOR_COOKIE)?.value;
  return isUuid(id) ? id : null;
}

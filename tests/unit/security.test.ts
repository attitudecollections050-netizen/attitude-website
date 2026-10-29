import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sniffImageType } from "@/lib/images";
import { Markdown } from "@/components/ui/Markdown";

describe("image upload validation", () => {
  it("identifies real image bytes", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.mime).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))?.mime).toBe("image/webp");
  });

  it("rejects disguised files regardless of name or claimed type", () => {
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>...."))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<?php system($_GET[1]); ?>"))).toBeNull();
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe("admin-edited page content", () => {
  const html = (src: string) => renderToStaticMarkup(createElement(Markdown, { source: src }));

  it("escapes raw HTML instead of rendering it", () => {
    const out = html("Hello <script>alert(1)</script> <img src=x onerror=alert(1)>");
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  it("only links to safe destinations", () => {
    const out = html("[bad](javascript:alert(1)) [good](/shipping-policy) [mail](mailto:hi@example.com)");
    expect(out).not.toContain('href="javascript:');
    expect(out).toContain('href="/shipping-policy"');
    expect(out).toContain('href="mailto:hi@example.com"');
  });

  it("highlights unfinished [placeholders]", () => {
    expect(html("Contact us at [support email].")).toContain('class="placeholder"');
  });
});

describe("staff roles", async () => {
  const { adminHome, can, isStaffRole, permissionsFor } = await import("@/lib/permissions");
  const ownerOnly = ["orders:read", "customers:read", "reports:read", "settings:write", "shipping:write", "discounts:write", "suppliers:write", "staff:manage", "catalog:write", "messages:read", "feedback:manage"] as const;

  it("Product Staff can manage products and nothing else", () => {
    const p = permissionsFor(["product_staff"]);
    expect(p).toEqual(["products:write", "earnings:self"]);
    for (const perm of ownerOnly) expect(p, perm).not.toContain(perm);
    expect(p).not.toContain("products:delete");
  });

  it("product deletion only when the owner allows it", () => {
    expect(permissionsFor(["product_staff"], { canDeleteProducts: true })).toContain("products:delete");
    // The flag means nothing for people who aren't Product Staff.
    expect(permissionsFor([], { canDeleteProducts: true })).toEqual([]);
    expect(permissionsFor(["staff"], { canDeleteProducts: true })).not.toContain("products:delete");
  });

  it("the owner keeps every permission, including Staff Management", () => {
    const p = permissionsFor(["admin"]);
    for (const perm of [...ownerOnly, "products:write", "products:delete"] as const) expect(p, perm).toContain(perm);
    expect(can(["admin"], "staff:manage")).toBe(true);
    expect(can(["staff"], "staff:manage")).toBe(false);
  });

  it("Product Staff land on Products; customers get no admin home", () => {
    expect(isStaffRole(["product_staff"])).toBe(true);
    expect(isStaffRole([])).toBe(false);
    expect(adminHome(permissionsFor(["product_staff"]))).toBe("/staff/dashboard");
    expect(adminHome(permissionsFor(["admin"]))).toBe("/admin");
    expect(adminHome([])).toBe("/admin/login?error=forbidden");
  });
});

describe("store owner", () => {
  it("needs the owner role and the owner's address", async () => {
    const { isStoreOwner } = await import("@/lib/owner");
    expect(isStoreOwner("AttitudeCollections050@gmail.com ", ["admin"])).toBe(true);
    expect(isStoreOwner("attitudecollections050@gmail.com", ["staff"])).toBe(false);
    expect(isStoreOwner("someone@example.com", ["admin"])).toBe(false);
    expect(isStoreOwner(null, ["admin"])).toBe(false);
  });
});

describe("staff earnings", () => {
  it("pays ₦1,000 per 10 live products and shows progress", async () => {
    const { earningsFor } = await import("@/lib/staff-earnings");
    expect(earningsFor(0)).toEqual({ earnedKobo: 0, progress: 0, remaining: 10, percent: 0 });
    expect(earningsFor(3)).toEqual({ earnedKobo: 0, progress: 3, remaining: 7, percent: 30 });
    expect(earningsFor(23)).toEqual({ earnedKobo: 200_000, progress: 3, remaining: 7, percent: 30 });
    expect(earningsFor(30).earnedKobo).toBe(300_000);
    expect(earningsFor(-5).earnedKobo).toBe(0);
  });
});

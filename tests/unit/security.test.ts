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

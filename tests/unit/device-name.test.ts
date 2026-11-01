import { describe, expect, it } from "vitest";
import { deviceFromUA } from "@/lib/device-name";

describe("device names for 'My Devices Receiving Push'", () => {
  it("names common phones and laptops", () => {
    expect(deviceFromUA("Mozilla/5.0 (Linux; Android 12; Infinix X6817 Build/SP1A.210812.016) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36").name).toBe("Chrome on Android phone · Infinix X6817");
    expect(deviceFromUA("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36", { model: "TECNO KI7", mobile: true }).name).toBe("Chrome on Android phone · TECNO KI7");
    expect(deviceFromUA("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36").name).toBe("Chrome on Android phone");
    expect(deviceFromUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1").name).toBe("Safari on iPhone");
    expect(deviceFromUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0").name).toBe("Edge on Windows laptop");
    expect(deviceFromUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36").name).toBe("Chrome on Mac");
    expect(deviceFromUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0").browser).toBe("Firefox");
  });
});

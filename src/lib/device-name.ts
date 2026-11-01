// A readable device name from the browser's user agent, e.g. "Chrome on Android · Infinix X6817",
// "Safari on iPhone", "Edge on Windows laptop". Used for "My Devices Receiving Push".

export interface DeviceInfo {
  name: string;
  browser: string;
}

export function browserFrom(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/CriOS\/|Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
}

/** "Infinix X6817" from "Linux; Android 12; Infinix X6817 Build/SP1A…" (when the browser still shares it). */
function androidModel(ua: string): string | null {
  const m = ua.match(/Android [\d.]+;\s*(?:[a-z]{2}[-_][A-Za-z]{2};\s*)?([^;)]+?)(?:\s+Build\/[^;)]*)?\)/);
  const model = m?.[1]?.trim();
  return model && model !== "K" && !/^wv$/i.test(model) && model.length <= 40 ? model : null;
}

export function deviceFromUA(ua: string, hints: { model?: string; platform?: string; mobile?: boolean } = {}): DeviceInfo {
  const browser = browserFrom(ua);
  let os = "computer";
  if (/iPhone/.test(ua)) os = "iPhone";
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && hints.mobile)) os = "iPad";
  else if (/Android/.test(ua)) os = /Mobile/.test(ua) || hints.mobile ? "Android phone" : "Android tablet";
  else if (/Windows/.test(ua)) os = "Windows laptop";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "Mac";
  else if (/CrOS/.test(ua)) os = "Chromebook";
  else if (/Linux/.test(ua)) os = "Linux computer";
  const model = (hints.model || (/Android/.test(ua) ? androidModel(ua) : null) || "").trim();
  const name = `${browser} on ${os}${model ? ` · ${model}` : ""}`;
  return { name: name.slice(0, 80), browser };
}

/** In the browser: uses the model from Client Hints where available (Chrome/Edge on Android). */
export async function detectDevice(): Promise<DeviceInfo> {
  const ua = navigator.userAgent;
  const uad = (navigator as unknown as { userAgentData?: { mobile?: boolean; getHighEntropyValues?: (h: string[]) => Promise<{ model?: string; platform?: string }> } }).userAgentData;
  let hints: { model?: string; platform?: string; mobile?: boolean } = { mobile: uad?.mobile ?? navigator.maxTouchPoints > 1 };
  try {
    if (uad?.getHighEntropyValues) hints = { ...hints, ...(await uad.getHighEntropyValues(["model", "platform"])) };
  } catch {}
  return deviceFromUA(ua, hints);
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { AudioLines, Check, Mic, MicOff, Palette, Ruler, SendHorizontal, ShoppingBag, Shirt, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { MAX_MESSAGE_CHARS, basicReply, linkify, type AssistantReply, type ChatTurn, type ProductSuggestion } from "@/lib/assistant/shared";
import { getConsent, browserOptedOut } from "@/lib/analytics/client";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/intl/PreferencesProvider";
import { DripBaby } from "./DripBaby";
import { DripStage } from "./DripStage";
import { useCart } from "@/components/cart/CartProvider";
import { onDrip } from "@/lib/assistant/events";
import { CHARACTERS, DEFAULT_LOOK, SKIN_TONES, actionLine, type CharacterId, type DripAction, type ModelLook } from "@/lib/assistant/characters";
import { RECOGNITION_LANG, canSpeak, englishVoices, getRecognitionCtor, pickVoice, primeVoices, requestMicrophone, saveVoiceName, savedVoiceName, speak, stopSpeaking, type Recognition } from "./voice";

interface Message extends ChatTurn {
  id: string;
  products?: ProductSuggestion[];
}

const STORE_KEY = "ac_drip_chat";
const CHAR_KEY = "ac_drip_character";
const LOOK_KEY = "ac_drip_look";
const GREETED_KEY = "ac_mini_greeted";
const VOICE_KEY = "ac_mini_voice";
const welcome = (c: CharacterId): Message => ({
  id: "welcome",
  role: "assistant",
  content:
    c === "queen"
      ? "Heyy baddie! 💗 I'm FAF Drip Queen. Tell me your size, vibe and budget and I'll find your fit, match your top with your pants, and answer anything about the store."
      : "Wetin dey sup, drip lord! 😎 I'm FAF Drip Guy. Tell me your height, fit (baggy, slim, vintage) and budget — I'll find your drip, check your size and match the fit.",
});
const CHIPS = [
  { label: "Style me 🔥", text: "Style me! Ask me what you need to know to pick my fit." },
  { label: "Baggy pants 👖", text: "Show me baggy pants" },
  { label: "Shirts & jerseys 👕", text: "Show me shirts and jerseys" },
  { label: "My size? 📏", text: "Help me find my size" },
  { label: "Delivery to Lagos/Abuja 🚚", text: "How long does delivery take to Lagos and Abuja?" },
  { label: "Roast my combo 😂", text: "I want to wear a yellow pant with a red shirt. Roast my combo and fix it." },
];
/** How long a one-off action plays before the character relaxes again. */
const ACTION_MS = 3600;

/** Pages where the chat stays out of the way (payment and account flows, admin). */
const hiddenOn = (path: string) => /^\/(checkout|admin|order)(\/|$)/.test(path);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const uid = () => Math.random().toString(36).slice(2, 10);

export function AssistantWidget() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  // Window labels follow the shopper's language; Dj Attitude Mini herself chats in English.
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  const [character, setCharacter] = useState<CharacterId>("guy");
  const [looks, setLooks] = useState<Record<CharacterId, ModelLook>>(DEFAULT_LOOK);
  const [customize, setCustomize] = useState(false);
  const [stage, setStage] = useState<{ action: DripAction; key: number; caption: string | null; images: (string | null)[] }>({ action: "pose", key: 0, caption: null, images: [] });
  const [popup, setPopup] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome("guy")]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"ai" | "basic" | "unknown">("unknown");
  const [voiceOn, setVoiceOn] = useState(false);
  const [talking, setTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [voicePicker, setVoicePicker] = useState<{ name: string; lang: string }[] | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [greeting, setGreeting] = useState(false);
  const [restored, setRestored] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<Recognition | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Restore the conversation for this browser tab.
  useEffect(() => {
    const t = setTimeout(() => {
      const c = load<CharacterId>(CHAR_KEY, "guy") === "queen" ? "queen" : "guy";
      setCharacter(c);
      setLooks({ ...DEFAULT_LOOK, ...load<Partial<Record<CharacterId, ModelLook>>>(LOOK_KEY, {}) });
      setMessages(load<Message[]>(STORE_KEY, [welcome(c)]));
      setVoiceOn(load<boolean>(VOICE_KEY, false));
      setMicSupported(Boolean(getRecognitionCtor()));
      setSpeechSupported(canSpeak());
      primeVoices();
      setRestored(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  // Save only after restoring, so the first render can't overwrite the saved chat.
  useEffect(() => {
    if (restored) save(STORE_KEY, messages.slice(-30));
  }, [messages, restored]);
  useEffect(() => {
    if (restored) save(VOICE_KEY, voiceOn);
  }, [voiceOn, restored]);
  useEffect(() => {
    if (!restored) return;
    save(CHAR_KEY, character);
    save(LOOK_KEY, looks);
  }, [character, looks, restored]);

  // The character's moves: play an action, then relax back into a street pose.
  const perform = useCallback((action: DripAction, caption: string | null = null, images: (string | null)[] = []) => {
    setStage((s) => ({ action, key: s.key + 1, caption, images }));
  }, []);
  useEffect(() => {
    if (stage.action === "pose" || stage.action === "idle") return;
    const loops = stage.action === "dance" || stage.action === "celebrate" || stage.action === "strut";
    const t = setTimeout(() => setStage((s) => ({ ...s, action: "pose", caption: null })), loops ? ACTION_MS * 1.6 : ACTION_MS);
    return () => clearTimeout(t);
  }, [stage.action, stage.key]);
  // Pop up beside the chat button when something happens while the chat is closed.
  const flash = useCallback(
    (action: DripAction, caption: string | null = null) => {
      perform(action, caption);
      setPopup(true);
    },
    [perform],
  );
  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(false), ACTION_MS);
    return () => clearTimeout(t);
  }, [popup, stage.key]);
  useEffect(
    () =>
      onDrip((e) => {
        const action: DripAction = e.type === "add_to_cart" ? (character === "queen" ? "blow_kiss" : "dab") : "celebrate";
        const line = e.type === "add_to_cart" ? actionLine("dab", character) : actionLine("celebrate", character);
        if (open) perform(action, line);
        else flash(action, line);
      }),
    [flash, perform, open, character],
  );

  // A one-time hello bubble, after the cookie question has been answered.
  useEffect(() => {
    if (load<boolean>(GREETED_KEY, false)) return;
    const t = setInterval(() => {
      if (getConsent() === null && !browserOptedOut()) return;
      clearInterval(t);
      setGreeting(true);
      save(GREETED_KEY, true);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, pending, reduce]);

  const stopAll = useCallback(() => {
    stopSpeaking();
    setTalking(false);
    recRef.current?.abort();
    setListening(false);
  }, []);
  useEffect(() => stopAll, [stopAll]);
  const closePanel = useCallback(() => {
    stopAll();
    setOpen(false);
    flash("wave");
  }, [stopAll, flash]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopAll();
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, stopAll]);


  const say = useCallback((text: string) => {
    speak(text, { onStart: () => setTalking(true), onEnd: () => setTalking(false) });
  }, []);

  const send = useCallback(
    async (raw: string, opts: { spoken?: boolean } = {}) => {
      const text = raw.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!text || pending) return;
      stopSpeaking();
      const userMsg: Message = { id: uid(), role: "user", content: text };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setPending(true);
      perform("think", "");
      const speakReply = voiceOn || opts.spoken;

      const answerBasic = () => {
        const reply = basicReply(text, Date.now());
        setMode("basic");
        return { reply, products: [] as ProductSuggestion[] };
      };

      let result: AssistantReply;
      if (mode === "basic") {
        await new Promise((r) => setTimeout(r, 450));
        result = answerBasic();
      } else {
        try {
          const res = await fetch("/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ character, messages: next.filter((m) => m.id !== "welcome").map(({ role, content }) => ({ role, content })) }),
          });
          const data = (await res.json().catch(() => ({}))) as Partial<AssistantReply> & { offline?: boolean; error?: string };
          if (res.ok && typeof data.reply === "string") {
            setMode("ai");
            result = { reply: data.reply, products: data.products ?? [], action: data.action ?? null };
          } else if (data.offline) {
            result = answerBasic();
          } else {
            result = { reply: data.error ?? "Oops, my turntable skipped! 🎧 Please try again.", products: [] };
          }
        } catch {
          result = answerBasic();
        }
      }
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: result.reply, products: result.products }]);
      setPending(false);
      const act = result.action ?? (result.products.length ? "strut" : "pose");
      perform(act, null, result.products.slice(0, 2).map((p) => p.image));
      if (speakReply) say(result.reply);
    },
    [messages, mode, pending, say, voiceOn, character, perform],
  );

  const toggleMic = async () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    stopSpeaking();
    setVoiceNote(null);
    // Ask for the microphone first so the browser shows its "Allow microphone" prompt.
    const access = await requestMicrophone();
    if (access !== "granted") {
      setVoiceNote(access === "unavailable" ? t("noMic") : t("micBlocked"));
      return;
    }
    const rec = new Ctor();
    rec.lang = RECOGNITION_LANG;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((finalText + interim).slice(0, MAX_MESSAGE_CHARS));
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setVoiceNote(t("micBlocked"));
      else if (e.error === "no-speech") setVoiceNote(t("noSpeech"));
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) {
        setVoiceOn(true); // a voice chat gets voice replies
        void send(finalText, { spoken: true });
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  if (hiddenOn(pathname)) return null;
  const showChips = messages.filter((m) => m.role === "user").length < 2 && !pending;

  return (
    <>
      <AnimatePresence>
        {greeting && !open && (
          <m.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-[5.6rem] right-4 z-[52] w-60 rounded-2xl rounded-br-sm border border-pale bg-white p-3.5 pr-8 text-sm shadow-[0_18px_40px_-18px_rgba(217,79,145,0.6)] sm:right-6"
            role="status"
          >
            <button type="button" onClick={() => setGreeting(false)} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full text-muted hover:bg-neutral" aria-label={t("dismiss")}>
              <X className="size-3.5" />
            </button>
            <p className="font-semibold">{t("greetTitle", { name: CHARACTERS[character].name })}</p>
            <p className="mt-0.5 text-xs text-muted">{t("greetBody")}</p>
            <button type="button" onClick={() => { setGreeting(false); setOpen(true); }} className="mt-2 text-xs font-semibold text-rose-deep underline underline-offset-4">{t("chatWithMe")}</button>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {popup && !open && (
          <m.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            className="pointer-events-none fixed bottom-[5.6rem] right-4 z-[52] w-64 overflow-hidden rounded-3xl border-2 border-white shadow-[0_18px_40px_-12px_rgba(255,20,147,0.7)] sm:right-6"
            role="status"
            data-testid="drip-popup"
          >
            <DripStage compact character={character} look={looks[character]} action={stage.action} playKey={stage.key} caption={stage.caption} images={stage.images} />
          </m.div>
        )}
      </AnimatePresence>

      <m.button
        ref={launcherRef}
        type="button"
        onClick={() => { setGreeting(false); if (open) closePanel(); else setOpen(true); }}
        aria-expanded={open}
        aria-controls="dj-mini-panel"
        aria-label={open ? t("closeNamed", { name: CHARACTERS[character].name }) : t("chatWith", { name: CHARACTERS[character].name })}
        className="fixed bottom-4 right-4 z-[52] size-16 rounded-full bg-gradient-to-br from-[#FF8CC6] to-[#FF1493] p-0.5 shadow-[0_14px_34px_-8px_rgba(255,20,147,0.85)] ring-2 ring-white transition hover:ring-[#FFD1E8] sm:right-6"
        animate={reduce || open ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        whileTap={{ scale: 0.92 }}
      >
        <DripBaby variant="head" character={character} look={looks[character]} talking={talking && !open} className="size-full" />
        {!open && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-rose text-[0.6rem] font-bold text-white shadow" aria-hidden>AI</span>}
      </m.button>

      <AnimatePresence>
        {open && (
          <m.section
            ref={panelRef}
            id="dj-mini-panel"
            role="dialog"
            aria-modal="false"
            aria-label={t("chatAria", { name: CHARACTERS[character].name })}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-x-2 bottom-[5.5rem] top-16 z-[53] flex flex-col overflow-hidden rounded-3xl border border-pale bg-white shadow-[0_30px_80px_-24px_rgba(37,25,35,0.45)] sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[min(38rem,calc(100dvh-8rem))] sm:w-[24rem]"
          >
            <header className="flex items-center gap-2 bg-gradient-to-br from-[#FF3EA5] to-[#9C1666] px-3 py-2.5 text-white">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-semibold leading-tight">{CHARACTERS[character].name}</p>
                <p className="flex items-center gap-1.5 text-[0.7rem] text-white/70">
                  <span className={cn("size-1.5 rounded-full", mode === "basic" ? "bg-amber-300" : "bg-emerald-400")} aria-hidden />
                  {listening ? t("listening") : talking ? t("talking") : mode === "basic" ? t("basicMode") : t("aiMode")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomize((v) => !v)}
                aria-expanded={customize}
                aria-label={t("modelLook")}
                title={t("modelLook")}
                className="grid size-9 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
              >
                <Palette className="size-4" />
              </button>
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (voicePicker) return setVoicePicker(null);
                    const voices = window.speechSynthesis.getVoices();
                    setVoiceName(pickVoice(voices, savedVoiceName())?.name ?? null);
                    setVoicePicker(englishVoices(voices).slice(0, 8).map((v) => ({ name: v.name, lang: v.lang })));
                  }}
                  aria-expanded={Boolean(voicePicker)}
                  aria-label={t("chooseVoice")}
                  title={t("chooseVoice")}
                  className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <AudioLines className="size-4" />
                </button>
              )}
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => { if (voiceOn) stopSpeaking(); setVoiceOn((v) => !v); }}
                  aria-pressed={voiceOn}
                  aria-label={voiceOn ? t("voiceStop") : t("voiceStart")}
                  title={voiceOn ? t("voiceOn") : t("voiceOff")}
                  className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </button>
              )}
              <button type="button" onClick={closePanel} aria-label={t("close")} className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="size-5" />
              </button>
            </header>
            {voicePicker && (
              <div className="border-b border-line bg-white px-3 py-3" role="group" aria-label={t("chooseVoice")}>
                <p className="px-1 text-xs font-semibold">{t("pickVoice")} <span className="font-normal text-muted">{t("englishVoices")}</span></p>
                {voicePicker.length === 0 ? (
                  <p className="mt-2 px-1 text-xs text-muted">{t("noVoices")}</p>
                ) : (
                  <ul className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                    {voicePicker.map((v) => (
                      <li key={v.name}>
                        <button
                          type="button"
                          onClick={() => {
                            saveVoiceName(v.name);
                            setVoiceName(v.name);
                            void speak(`Hi! I'm ${CHARACTERS[character].name}. You like my voice?`, { onStart: () => setTalking(true), onEnd: () => setTalking(false) });
                          }}
                          aria-pressed={voiceName === v.name}
                          className={cn("flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition", voiceName === v.name ? "border-rose bg-pale font-semibold text-rose-deep" : "border-line hover:border-rose")}
                        >
                          {voiceName === v.name && <Check className="size-3" aria-hidden />}
                          {v.name.replace(/^(Microsoft|Google)\s+/i, "").replace(/\s*-\s*English.*$/i, "").replace(/\s*\(Natural\)/i, "").slice(0, 28)}
                          <span className="text-[0.6rem] text-muted">{v.lang.replace("_", "-")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="relative shrink-0">
              <div className="absolute right-2 top-2 z-10 flex rounded-full bg-black/20 p-0.5 text-[0.65rem] font-bold backdrop-blur" role="group" aria-label={t("character")}>
                {(["guy", "queen"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={character === c}
                    onClick={() => {
                      if (c === character) return;
                      setCharacter(c);
                      perform("strut", c === "queen" ? "Drip Queen don land! 💅 Your turn, sis." : "Drip Guy in the building! 😎 Wetin we dey cop?");
                    }}
                    className={cn("rounded-full px-2.5 py-1 transition", character === c ? "bg-white text-[#C2185B]" : "text-white/85 hover:text-white")}
                    data-testid={`char-${c}`}
                  >
                    {c === "guy" ? t("guy") : t("queen")}
                  </button>
                ))}
              </div>
              <DripStage character={character} look={looks[character]} action={stage.action} playKey={stage.key} caption={stage.caption} images={stage.images} talking={talking} listening={listening} className="h-36 border-b-2 border-white" />
            </div>
            {customize && (
              <ModelCustomizer
                look={looks[character]}
                onChange={(look) => {
                  setLooks((l) => ({ ...l, [character]: look }));
                  perform("spin", "New look, who dis? 😎");
                }}
              />
            )}

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#FFF0F7] px-3 py-4" aria-live="polite" aria-relevant="additions">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  character={character}
                  look={looks[character]}
                  onListen={speechSupported ? () => say(msg.content) : undefined}
                  onTryOn={(p) => perform("try_on", null, [p.image])}
                  onSize={(p) => {
                    perform("measure");
                    void send(`What size should I get in ${p.name}? Ask me what you need (height, weight, waist, fit) and help me choose.`);
                  }}
                  onMatch={(p) => {
                    perform("think", "");
                    void send(`What goes well with ${p.name}? Suggest pieces from the store to complete the fit.`);
                  }}
                />
              ))}
              {pending && (
                <div className="flex items-end gap-2" role="status">
                  <span className="size-7 shrink-0"><DripBaby variant="head" character={character} look={looks[character]} className="size-full" /></span>
                  <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 shadow-sm">
                    <span className="sr-only">{t("typing", { name: CHARACTERS[character].name })}</span>
                    {[0, 1, 2].map((i) => (
                      <m.span key={i} className="size-1.5 rounded-full bg-rose" animate={reduce ? undefined : { y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} aria-hidden />
                    ))}
                  </span>
                </div>
              )}
              {showChips && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {CHIPS.map((c) => (
                    <button key={c.label} type="button" onClick={() => void send(c.text)} className="rounded-full border border-rose/40 bg-white px-3 py-1.5 text-xs font-semibold text-rose-deep transition hover:border-rose hover:bg-pale">
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); void send(input); }}
              className="border-t border-line bg-white p-2.5"
            >
              {voiceNote && <p className="mb-2 px-1 text-xs text-danger" role="alert">{voiceNote}</p>}
              <div className="flex items-end gap-2">
                {micSupported && (
                  <button
                    type="button"
                    onClick={() => void toggleMic()}
                    aria-pressed={listening}
                    aria-label={listening ? t("micStop") : t("micStart")}
                    className={cn("relative grid size-11 shrink-0 place-items-center rounded-full transition", listening ? "bg-rose text-white" : "bg-pale text-rose-deep hover:bg-rose hover:text-white")}
                  >
                    {listening && !reduce && <m.span className="absolute inset-0 rounded-full bg-rose" animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1, repeat: Infinity }} aria-hidden />}
                    {listening ? <MicOff className="relative size-5" /> : <Mic className="relative size-5" />}
                  </button>
                )}
                <label className="sr-only" htmlFor="dj-mini-input">{t("messageLabel", { name: CHARACTERS[character].name })}</label>
                <textarea
                  id="dj-mini-input"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  maxLength={MAX_MESSAGE_CHARS}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  placeholder={listening ? t("speakNow") : t("placeholder")}
                  className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-neutral px-3.5 py-2.5 text-sm outline-none transition focus:border-rose focus:bg-white"
                />
                <button type="submit" disabled={!input.trim() || pending} aria-label={t("send")} className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FF3EA5] to-[#C2185B] text-white transition hover:brightness-110 disabled:opacity-40">
                  <SendHorizontal className="size-5" />
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[0.65rem] leading-snug text-muted">
                {mode === "basic" ? t("basicNote") : t("aiNote")} {t("privacyNote")}
                {micSupported ? ` ${t("voiceNote")}` : ""}
              </p>
            </form>
          </m.section>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({
  msg,
  character,
  look,
  onListen,
  onTryOn,
  onSize,
  onMatch,
}: {
  msg: Message;
  character: CharacterId;
  look: ModelLook;
  onListen?: () => void;
  onTryOn: (p: ProductSuggestion) => void;
  onSize: (p: ProductSuggestion) => void;
  onMatch: (p: ProductSuggestion) => void;
}) {
  const mine = msg.role === "user";
  const t = useTranslations("assistant");
  return (
    <div className={cn("flex items-end gap-2", mine && "justify-end")}>
      {!mine && <span className="size-7 shrink-0"><DripBaby variant="head" character={character} look={look} className="size-full" /></span>}
      <div className={cn("max-w-[82%]", mine && "text-right")}>
        <div className={cn("inline-block whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed shadow-sm", mine ? "rounded-br-sm bg-gradient-to-br from-[#FF3EA5] to-[#C2185B] text-white" : "rounded-bl-sm border border-[#FFD1E8] bg-white text-plum")}>
          {mine
            ? msg.content
            : linkify(msg.content).map((part, i) =>
                part.type === "text" ? (
                  <span key={i}>{part.value.replace(/\*\*([^*]+)\*\*/g, "$1")}</span>
                ) : (
                  <Link key={i} href={part.href} className="font-semibold text-rose-deep underline underline-offset-2">
                    {part.label}
                  </Link>
                ),
              )}
        </div>
        {!mine && msg.products && msg.products.length > 0 && (
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {msg.products.map((p) => (
              <ProductCard key={p.href} p={p} onTryOn={onTryOn} onSize={onSize} onMatch={onMatch} />
            ))}
          </ul>
        )}
        {!mine && onListen && msg.id !== "welcome" && (
          <button type="button" onClick={onListen} className="mt-1 inline-flex items-center gap-1 text-[0.65rem] font-semibold text-muted hover:text-rose-deep" aria-label={t("listenAria")}>
            <Volume2 className="size-3" aria-hidden /> {t("listen")}
          </button>
        )}
      </div>
    </div>
  );
}

/** A product from the chat with the four quick buttons: Try On, My Size?, Match This, Add to Cart. */
function ProductCard({ p, onTryOn, onSize, onMatch }: { p: ProductSuggestion; onTryOn: (p: ProductSuggestion) => void; onSize: (p: ProductSuggestion) => void; onMatch: (p: ProductSuggestion) => void }) {
  const t = useTranslations("assistant");
  const money = useMoney();
  const cart = useCart();
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const options = (p.variants ?? []).filter((v) => v.inStock);
  const add = async (variantId: string) => {
    setPicking(false);
    const r = await cart.add(variantId, 1, { openDrawer: false });
    setNote(r.ok ? t("added") : r.error);
  };
  const btn = "flex items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[0.62rem] font-bold leading-none transition";
  return (
    <li className="w-40 shrink-0" data-testid="chat-product">
      <div className="overflow-hidden rounded-xl border border-[#FFD1E8] bg-white text-left">
        <Link href={p.href} className="block">
          <div className="relative aspect-square bg-pale">
            <SmartImage src={p.image} alt={p.name} fill sizes="160px" className="object-cover" />
          </div>
          <div className="p-2 pb-1">
            <p className="line-clamp-2 text-[0.7rem] font-semibold leading-snug">{p.name}</p>
            <p className="mt-0.5 text-[0.7rem] tabular-nums">
              {p.priceMinor != null ? money.format(p.priceMinor) : p.price}
              {p.wasPrice && <s className="ml-1 text-muted">{p.wasPriceMinor != null ? money.format(p.wasPriceMinor) : p.wasPrice}</s>}
            </p>
            {!p.inStock && <p className="text-[0.6rem] text-danger">{t("soldOut")}</p>}
          </div>
        </Link>
        <div className="grid grid-cols-2 gap-1 p-1.5 pt-0">
          <button type="button" onClick={() => onTryOn(p)} className={cn(btn, "bg-[#FFE3F1] text-[#C2185B] hover:bg-[#FFD1E8]")}>
            <Sparkles className="size-3" aria-hidden /> {t("tryOn")}
          </button>
          <button type="button" onClick={() => onSize(p)} className={cn(btn, "bg-[#FFE3F1] text-[#C2185B] hover:bg-[#FFD1E8]")}>
            <Ruler className="size-3" aria-hidden /> {t("mySize")}
          </button>
          <button type="button" onClick={() => onMatch(p)} className={cn(btn, "bg-[#FFE3F1] text-[#C2185B] hover:bg-[#FFD1E8]")}>
            <Shirt className="size-3" aria-hidden /> {t("matchThis")}
          </button>
          {options.length ? (
            <button
              type="button"
              disabled={cart.pending}
              onClick={() => (options.length === 1 ? void add(options[0].id) : setPicking((v) => !v))}
              aria-expanded={options.length > 1 ? picking : undefined}
              className={cn(btn, "bg-gradient-to-r from-[#FF3EA5] to-[#C2185B] text-white hover:brightness-110 disabled:opacity-50")}
              data-testid="chat-add"
            >
              <ShoppingBag className="size-3" aria-hidden /> {t("addToCart")}
            </button>
          ) : (
            <Link href={p.href} className={cn(btn, "bg-gradient-to-r from-[#FF3EA5] to-[#C2185B] text-white hover:brightness-110")}>
              <ShoppingBag className="size-3" aria-hidden /> {p.inStock ? t("addToCart") : t("view")}
            </Link>
          )}
        </div>
        {picking && (
          <div className="border-t border-[#FFD1E8] p-1.5" role="group" aria-label={t("pickSize")}>
            <p className="px-0.5 text-[0.6rem] font-semibold text-muted">{t("pickSize")}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {options.map((v) => (
                <button key={v.id} type="button" onClick={() => void add(v.id)} className="rounded-full border border-[#FF8CC6] px-2 py-0.5 text-[0.62rem] font-semibold text-[#C2185B] hover:bg-[#FFE3F1]">
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {note && <p className="px-2 pb-1.5 text-[0.6rem] font-semibold text-[#C2185B]" role="status">{note}</p>}
      </div>
    </li>
  );
}

/** The shopper can change the character's skin tone, build and height (virtual model look). */
function ModelCustomizer({ look, onChange }: { look: ModelLook; onChange: (look: ModelLook) => void }) {
  const t = useTranslations("assistant");
  const chip = (on: boolean) => cn("rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold transition", on ? "border-[#FF1493] bg-[#FFE3F1] text-[#C2185B]" : "border-line hover:border-[#FF8CC6]");
  return (
    <div className="space-y-2 border-b border-[#FFD1E8] bg-white px-3 py-2.5 text-xs" data-testid="model-customizer">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-semibold">{t("skin")}</span>
        <div className="flex gap-1.5">
          {SKIN_TONES.map((c) => (
            <button key={c} type="button" onClick={() => onChange({ ...look, skin: c })} aria-pressed={look.skin === c} aria-label={`${t("skin")} ${c}`} className={cn("size-6 rounded-full border-2 transition", look.skin === c ? "border-[#FF1493] scale-110" : "border-white shadow")} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-semibold">{t("build")}</span>
        <div className="flex flex-wrap gap-1">
          {(["slim", "regular", "thick"] as const).map((b) => (
            <button key={b} type="button" aria-pressed={look.build === b} onClick={() => onChange({ ...look, build: b })} className={chip(look.build === b)}>
              {t(`build_${b}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-semibold">{t("height")}</span>
        <div className="flex flex-wrap gap-1">
          {(["short", "average", "tall"] as const).map((h) => (
            <button key={h} type="button" aria-pressed={look.height === h} onClick={() => onChange({ ...look, height: h })} className={chip(look.height === h)}>
              {t(`height_${h}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

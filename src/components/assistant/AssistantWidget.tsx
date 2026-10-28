"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { AudioLines, Check, Mic, MicOff, SendHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { ASSISTANT_NAME, MAX_MESSAGE_CHARS, basicReply, linkify, type AssistantReply, type ChatTurn, type ProductSuggestion } from "@/lib/assistant/shared";
import { getConsent, browserOptedOut } from "@/lib/analytics/client";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/cn";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/intl/PreferencesProvider";
import { MiniAvatar } from "./MiniAvatar";
import { RECOGNITION_LANG, canSpeak, englishVoices, getRecognitionCtor, pickVoice, primeVoices, requestMicrophone, saveVoiceName, savedVoiceName, speak, stopSpeaking, type Recognition } from "./voice";

interface Message extends ChatTurn {
  id: string;
  products?: ProductSuggestion[];
}

const STORE_KEY = "ac_mini_chat";
const GREETED_KEY = "ac_mini_greeted";
const VOICE_KEY = "ac_mini_voice";
const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content: "Heyyy! 🎧 I'm Dj Attitude Mini, your tiny style DJ. Ask me anything about the store, let me find you an outfit, or say “joke” and I'll make you laugh!",
};
const CHIPS = [
  { label: "Tell me a joke 😂", text: "Tell me a funny joke" },
  { label: "Ask me a question 🎤", text: "Ask me a fun question" },
  { label: "Find me an outfit 🛍️", text: "Help me find an outfit for a party" },
  { label: "Delivery & returns 🚚", text: "How do delivery and returns work?" },
  { label: "Track my order 📦", text: "How do I track my order?" },
];

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
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
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
      setMessages(load<Message[]>(STORE_KEY, [WELCOME]));
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
  }, [stopAll]);

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
            body: JSON.stringify({ messages: next.filter((m) => m.id !== "welcome").map(({ role, content }) => ({ role, content })) }),
          });
          const data = (await res.json().catch(() => ({}))) as Partial<AssistantReply> & { offline?: boolean; error?: string };
          if (res.ok && typeof data.reply === "string") {
            setMode("ai");
            result = { reply: data.reply, products: data.products ?? [] };
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
      if (speakReply) say(result.reply);
    },
    [messages, mode, pending, say, voiceOn],
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
            <p className="font-semibold">{t("greetTitle", { name: ASSISTANT_NAME })}</p>
            <p className="mt-0.5 text-xs text-muted">{t("greetBody")}</p>
            <button type="button" onClick={() => { setGreeting(false); setOpen(true); }} className="mt-2 text-xs font-semibold text-rose-deep underline underline-offset-4">{t("chatWithMe")}</button>
          </m.div>
        )}
      </AnimatePresence>

      <m.button
        ref={launcherRef}
        type="button"
        onClick={() => { setGreeting(false); if (open) closePanel(); else setOpen(true); }}
        aria-expanded={open}
        aria-controls="dj-mini-panel"
        aria-label={open ? t("closeNamed", { name: ASSISTANT_NAME }) : t("chatWith", { name: ASSISTANT_NAME })}
        className="fixed bottom-4 right-4 z-[52] size-16 rounded-full bg-white p-1 shadow-[0_14px_34px_-10px_rgba(217,79,145,0.75)] ring-2 ring-rose/70 transition hover:ring-rose sm:right-6"
        animate={reduce || open ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        whileTap={{ scale: 0.92 }}
      >
        <MiniAvatar talking={talking && !open} className="size-full" />
        {!open && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-rose text-[0.6rem] font-bold text-white shadow" aria-hidden>AI</span>}
      </m.button>

      <AnimatePresence>
        {open && (
          <m.section
            ref={panelRef}
            id="dj-mini-panel"
            role="dialog"
            aria-modal="false"
            aria-label={t("chatAria", { name: ASSISTANT_NAME })}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-x-2 bottom-[5.5rem] top-16 z-[53] flex flex-col overflow-hidden rounded-3xl border border-pale bg-white shadow-[0_30px_80px_-24px_rgba(37,25,35,0.45)] sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[min(38rem,calc(100dvh-8rem))] sm:w-[24rem]"
          >
            <header className="flex items-center gap-3 bg-gradient-to-br from-plum to-[#4a2140] px-4 py-3 text-white">
              <span className="size-12 shrink-0 rounded-full bg-white/10 p-0.5"><MiniAvatar talking={talking} listening={listening} className="size-full" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl leading-tight">{ASSISTANT_NAME}</p>
                <p className="flex items-center gap-1.5 text-[0.7rem] text-white/70">
                  <span className={cn("size-1.5 rounded-full", mode === "basic" ? "bg-amber-300" : "bg-emerald-400")} aria-hidden />
                  {listening ? t("listening") : talking ? t("talking") : mode === "basic" ? t("basicMode") : t("aiMode")}
                </p>
              </div>
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
                            void speak("Hi! I'm Dj Attitude Mini. Do you like my voice?", { onStart: () => setTalking(true), onEnd: () => setTalking(false) });
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

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-blush/50 px-3 py-4" aria-live="polite" aria-relevant="additions">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} onListen={speechSupported ? () => say(msg.content) : undefined} />
              ))}
              {pending && (
                <div className="flex items-end gap-2" role="status">
                  <span className="size-7 shrink-0"><MiniAvatar className="size-full" /></span>
                  <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 shadow-sm">
                    <span className="sr-only">{t("typing", { name: ASSISTANT_NAME })}</span>
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
                <label className="sr-only" htmlFor="dj-mini-input">{t("messageLabel", { name: ASSISTANT_NAME })}</label>
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
                <button type="submit" disabled={!input.trim() || pending} aria-label={t("send")} className="grid size-11 shrink-0 place-items-center rounded-full bg-plum text-white transition hover:bg-rose-deep disabled:opacity-40">
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

function MessageBubble({ msg, onListen }: { msg: Message; onListen?: () => void }) {
  const mine = msg.role === "user";
  const t = useTranslations("assistant");
  const money = useMoney();
  return (
    <div className={cn("flex items-end gap-2", mine && "justify-end")}>
      {!mine && <span className="size-7 shrink-0"><MiniAvatar className="size-full" /></span>}
      <div className={cn("max-w-[82%]", mine && "text-right")}>
        <div className={cn("inline-block whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed shadow-sm", mine ? "rounded-br-sm bg-rose-deep text-white" : "rounded-bl-sm bg-white text-plum")}>
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
              <li key={p.href} className="w-32 shrink-0">
                <Link href={p.href} className="block overflow-hidden rounded-xl border border-line bg-white text-left transition hover:border-rose">
                  <div className="relative aspect-square bg-pale">
                    <SmartImage src={p.image} alt={p.name} fill sizes="128px" className="object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-[0.7rem] font-semibold leading-snug">{p.name}</p>
                    <p className="mt-0.5 text-[0.7rem] tabular-nums">
                      {p.priceMinor != null ? money.format(p.priceMinor) : p.price}
                      {p.wasPrice && <s className="ml-1 text-muted">{p.wasPriceMinor != null ? money.format(p.wasPriceMinor) : p.wasPrice}</s>}
                    </p>
                    {!p.inStock && <p className="text-[0.6rem] text-danger">{t("soldOut")}</p>}
                  </div>
                </Link>
              </li>
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

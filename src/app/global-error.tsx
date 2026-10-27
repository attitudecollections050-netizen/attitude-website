"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FFF0F5", color: "#251923", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ letterSpacing: "0.3em", fontSize: 12 }}>ATTITUDE COLLECTIONS</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 40 }}>Something went wrong.</h1>
          <button onClick={reset} style={{ background: "#251923", color: "#fff", border: 0, padding: "14px 28px", letterSpacing: "0.2em", fontSize: 12, cursor: "pointer" }}>
            TRY AGAIN
          </button>
        </div>
      </body>
    </html>
  );
}

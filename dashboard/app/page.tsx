"use client";

import { useCallback, useState } from "react";

type Ticket = {
  id: string;
  change: {
    kind: string;
    name: string;
    before?: string;
    after?: string;
    origin_platform: string;
  };
  verdict: "propagate" | "hold" | "flag";
  confidence: number;
  reason: string;
  convention_refs: string[];
  proposed_fix?: { target_platform: string; file: string; diff: string };
  status: string;
};

const VERDICT_STYLES: Record<string, string> = {
  propagate: "#22c55e",
  hold: "#3b82f6",
  flag: "#f59e0b",
};

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: "Settings", mode: "token" }),
      });
      if (!res.ok) throw new Error(`Engine error: ${res.status}`);
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  const overrideTicket = (id: string, newVerdict: Ticket["verdict"]) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, verdict: newVerdict, status: "overridden" } : t
      )
    );
  };

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", minHeight: "100vh", gap: 1, background: "#1e293b" }}>
      <aside style={{ padding: 16, background: "#0f172a", borderRight: "1px solid #334155" }}>
        <h2 style={{ marginTop: 0 }}>iOS</h2>
        <div style={{ borderRadius: 24, border: "2px solid #334155", aspectRatio: "9/19", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14, textAlign: "center", padding: 16 }}>
          Simulator screenshot
          <br />
          <small>(from Mac build)</small>
        </div>
      </aside>

      <section style={{ padding: 16, overflow: "auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Design Diplomat</h1>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 14 }}>Verdict console</p>
          </div>
          <button
            onClick={runPipeline}
            disabled={loading}
            style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "Running…" : "Run pipeline"}
          </button>
        </header>

        {error && <p style={{ color: "#f87171" }}>{error}</p>}

        {tickets.length === 0 && !loading && (
          <p style={{ color: "#64748b" }}>Run pipeline to detect and classify token changes.</p>
        )}

        {tickets.map((t) => (
          <article key={t.id} style={{ background: "#0f172a", borderRadius: 12, padding: 16, marginBottom: 12, borderLeft: `4px solid ${VERDICT_STYLES[t.verdict]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ textTransform: "uppercase", color: VERDICT_STYLES[t.verdict] }}>{t.verdict}</strong>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{Math.round(t.confidence * 100)}% confidence</span>
            </div>
            <p style={{ margin: "8px 0" }}>{t.reason}</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              {t.change.name}: {t.change.before} → {t.change.after}
            </p>
            {t.convention_refs.length > 0 && (
              <p style={{ fontSize: 11, color: "#475569", margin: "8px 0 0" }}>Rules: {t.convention_refs.join(", ")}</p>
            )}
            {t.proposed_fix && (
              <pre style={{ background: "#1e293b", padding: 12, borderRadius: 8, fontSize: 12, overflow: "auto", marginTop: 12 }}>{t.proposed_fix.diff}</pre>
            )}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={() => overrideTicket(t.id, "propagate")} style={btnStyle}>Accept</button>
              <button onClick={() => overrideTicket(t.id, "hold")} style={{ ...btnStyle, background: "#334155" }}>Override → Hold</button>
            </div>
          </article>
        ))}
      </section>

      <aside style={{ padding: 16, background: "#0f172a", borderLeft: "1px solid #334155" }}>
        <h2 style={{ marginTop: 0 }}>Android</h2>
        <div style={{ borderRadius: 24, border: "2px solid #334155", aspectRatio: "9/19", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14, textAlign: "center", padding: 16 }}>
          Emulator screenshot
          <br />
          <small>(from Windows build)</small>
        </div>
      </aside>
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 13,
};

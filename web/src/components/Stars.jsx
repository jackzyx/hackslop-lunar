import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { Mic, Send, Volume2, VolumeX, RotateCcw, Repeat2, X, Square } from "lucide-react";
import { answer, speakable, LIMITATIONS } from "@/stars/brain.js";
import { parseRules, reconcile } from "@/stars/intents.js";
import { interpret, probe, MODEL } from "@/stars/llm.js";
import { createVoice, localListener } from "@/stars/voice.js";
import { OBJECTIVES } from "@/domain/screening.js";

const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const LABEL = { idle: "IDLE", listening: "LISTENING", thinking: "THINKING", speaking: "SPEAKING", error: "ERROR" };
const h = (x) => `${Math.round(x)} h`;

function Wave({ state }) {
  return <span className="stars-wave" data-state={state} aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ "--i": i }} />)}</span>;
}

function Basis({ res }) {
  const b = res.basis;
  return <div className="stars-basis">
    {b && <>
      <p className="hud-label">Screen · landing {b.when}{b.delay ? ` (${b.delay > 0 ? "+" : "−"}${Math.abs(b.delay)} d)` : ""} · 30 days · ranked by {OBJECTIVES[b.prefs.objective]}</p>
      <table>
        <thead><tr><th>Site</th><th>Sun</th><th>Dark gap</th><th>Earth</th><th>Result</th></tr></thead>
        <tbody>{b.rows.map((r) => <tr key={r.id} data-pass={r.complete ? (r.review ? "review" : r.pass) : "nodata"}>
          <td>{r.name}</td>
          <td>{r.m ? h(r.m.sunlit) : "–"}</td><td>{r.m ? h(r.m.darkGap) : "–"}</td><td>{r.m ? h(r.m.earth) : "–"}</td>
          <td>{!r.complete ? "NO DATA" : r.review ? "UNDER REVIEW" : r.pass ? `PASS${b.ranked[0]?.id === r.id && b.status === "winner" ? " · #1" : ""}` : `FAIL: ${r.fails.map((f) => f.label).join(", ")}`}</td>
        </tr>)}</tbody>
      </table>
      <p className="caption">Criteria: sunlight ≥ {h(b.prefs.minSunlitH)}{b.prefs.maxDarkGapH !== null && `, longest dark gap ≤ ${h(b.prefs.maxDarkGapH)}`}{b.prefs.minEarthH !== null && `, Earth ≥ ${h(b.prefs.minEarthH)}`}. Differences under 12 h count as ties. Malapert Massif is held out of rankings pending review of the V4 cross-check.</p>
    </>}
    <p className="hud-label">What this does not tell you</p>
    <ul>{LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
  </div>;
}

// The STARS corner assistant. It reads app state through `ctx`, answers from brain.js, and can only
// change the app through `onApply(patch)` (which the app validates) after the user presses Apply.
export default function Stars({ ctx, stateKey, live, onApply, onUndo, canUndo, onFocus }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState("idle");
  const [log, setLog] = useState([]); // { who: "you" | "stars", text, res?, key?, source? }
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(() => store.get("stars-muted") === "1");
  const [llm, setLlm] = useState({ ok: null, reason: "checking" });
  const [voiceName, setVoiceName] = useState(null);
  const [listen, setListen] = useState(null);
  const [showBasis, setShowBasis] = useState(false);
  const [notice, setNotice] = useState(null);
  const seq = useRef(0), abort = useRef(null), voice = useRef(null), stopListen = useRef(null), lastSaid = useRef("");
  const input = useRef(null), logEnd = useRef(null);
  const ctxRef = useRef(ctx), keyRef = useRef(stateKey), mutedRef = useRef(muted);
  ctxRef.current = ctx; keyRef.current = stateKey; mutedRef.current = muted;

  useEffect(() => {
    voice.current = createVoice(({ speaking, voice: name }) => { setVoiceName(name); setState((s) => (speaking ? "speaking" : s === "speaking" ? "idle" : s)); });
    localListener().then(setListen);
    return () => voice.current?.dispose();
  }, []);
  useEffect(() => { if (open && llm.ok !== true) probe().then(setLlm); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) requestAnimationFrame(() => input.current?.focus()); }, [open]);
  useEffect(() => { logEnd.current?.scrollIntoView({ block: "nearest" }); }, [log]);

  const say = (res) => {
    const line = speakable(res);
    lastSaid.current = line;
    if (!mutedRef.current) voice.current?.speak(line);
  };

  // Ask: the model (if up) only interprets the words. The answer is computed afterwards from the
  // latest app state, so a slow reply can never describe, or change, an outdated view.
  async function ask(q) {
    q = q.trim();
    if (!q) return;
    const mine = ++seq.current;
    abort.current?.abort();
    const ac = (abort.current = new AbortController());
    voice.current?.stop();
    setText(""); setNotice(null); setShowBasis(false);
    setLog((l) => [...l.slice(-7), { who: "you", text: q }]);
    setState("thinking");
    const { sites, picks } = ctxRef.current;
    let intent = parseRules(q, sites), source = "rules";
    if (llm.ok === false) probe().then(setLlm); // model came back? use it from the next question
    if (llm.ok) {
      try {
        const raw = await interpret(q, { sites, picks, signal: ac.signal });
        const r = reconcile(q, raw, sites);
        intent = r.intent; source = r.source === "model" ? "model" : "rules (model output rejected)";
      } catch (e) {
        if (mine !== seq.current) return; // superseded by a newer question
        if (e.name !== "AbortError") { setLlm({ ok: false, reason: e.name === "TimeoutError" ? "model timed out" : "Ollama not reachable" }); source = "rules (model unavailable)"; }
      }
    }
    if (mine !== seq.current) return;
    const res = answer(intent, ctxRef.current);
    setLog((l) => [...l.slice(-7), { who: "stars", res, key: keyRef.current, source }]);
    setState("idle");
    if (res.focus) onFocus();
    say(res);
  }

  const last = [...log].reverse().find((m) => m.who === "stars");
  const stale = last?.res.proposal && last.key !== stateKey;
  const apply = () => {
    if (!last?.res.proposal || stale) return;
    const errors = onApply(last.res.proposal.patch);
    if (errors.length) { setState("error"); setNotice(`Refused: ${errors.join("; ")}`); return; }
    setNotice(`Applied: ${last.res.proposal.label}.`);
    if (last.res.proposal.patch.picks) onFocus();
    setLog((l) => l.map((m) => (m === last ? { ...m, applied: true } : m)));
  };

  const ptt = () => {
    if (stopListen.current) { stopListen.current(); return; }
    voice.current?.stop();
    setState("listening");
    stopListen.current = listen({ onText: (t) => { setText(t); ask(t); }, onEnd: () => { stopListen.current = null; setState((s) => (s === "listening" ? "idle" : s)); } });
    if (!stopListen.current) setState("error");
  };
  const onKey = useEffectEvent((e) => { if (e.key === "Escape" && open) { voice.current?.stop(); setOpen(false); } });
  useEffect(() => { const k = (e) => onKey(e); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);

  const toggleMute = () => { const m = !muted; setMuted(m); store.set("stars-muted", m ? "1" : "0"); if (m) voice.current?.stop(); };
  const shownState = state === "error" || notice?.startsWith("Refused") ? "error" : state;

  return <div className="stars" data-open={open}>
    {!open && <p className="stars-bubble" aria-live="off">{live}</p>}
    {open && <section className="stars-panel hud" id={id} aria-label="STARS assistant">
      <header className="stars-head">
        <Wave state={shownState} />
        <b className="glow">STARS</b>
        <span className="stars-state" data-state={shownState} role="status">{LABEL[shownState]}</span>
        <span className="stars-mode" title={llm.ok ? `Local model ${MODEL} via Ollama` : `Deterministic mode: ${llm.reason}. Every answer still comes from the app's own numbers.`}>{llm.ok ? "LOCAL LLM" : llm.ok === null ? "…" : "RULES"}</span>
        <button type="button" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute voice" : "Mute voice"} title={voiceName ? `Voice: ${voiceName} (on this machine)` : "No offline voice installed: text only"}>{muted || !voiceName ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
        <button type="button" onClick={() => { voice.current?.stop(); setOpen(false); }} aria-label="Close STARS"><X size={16} /></button>
      </header>
      <p className="stars-live"><span className="hud-label">LIVE</span> {live}</p>

      <div className="stars-log" aria-live="polite">
        {log.length === 0 && <p className="caption">Ask me which site suits a 30-day mission, why a site fails, or what a date change does.</p>}
        {log.map((m, k) => m.who === "you"
          ? <p key={k} className="stars-you">› {m.text}</p>
          : <div key={k} className="stars-msg">
            {m.res.notes.map((n) => <p key={n} className="stars-note">{n}</p>)}
            {m.res.lines.map((l) => <p key={l}>{l}</p>)}
            <p className="stars-quip">{m.res.quip}<span className="stars-src"> · {m.source}</span></p>
          </div>)}
        <span ref={logEnd} />
      </div>

      {last && <div className="stars-actions">
        {last.res.proposal && !last.applied && <button type="button" className="stars-apply" disabled={stale} onClick={apply} title={stale ? "The view changed since this answer. Ask again." : "Apply this change"}>
          {stale ? "Out of date: ask again" : `Preview → Apply: ${last.res.proposal.label}`}
        </button>}
        {canUndo && <button type="button" onClick={() => { onUndo(); setNotice("Undone."); }}><RotateCcw size={14} /> Undo</button>}
        <button type="button" onClick={() => setShowBasis(!showBasis)} aria-expanded={showBasis}>{showBasis ? "Hide basis" : "Basis"}</button>
        {lastSaid.current && voiceName && !muted && (state === "speaking"
          ? <button type="button" onClick={() => voice.current?.stop()}><Square size={12} /> Stop</button>
          : <button type="button" onClick={() => voice.current?.speak(lastSaid.current)}><Repeat2 size={14} /> Repeat</button>)}
      </div>}
      {notice && <p className="stars-notice" role="status">{notice}</p>}
      {showBasis && last && <Basis res={last.res} />}

      <form className="stars-input" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <label htmlFor={`${id}-q`} className="sr-only">Ask STARS</label>
        <input id={`${id}-q`} ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask STARS…" autoComplete="off" maxLength={500} />
        {listen && <button type="button" onClick={ptt} aria-pressed={state === "listening"} aria-label="Push to talk (on-device recognition)"><Mic size={16} /></button>}
        <button type="submit" aria-label="Send" disabled={!text.trim()}><Send size={16} /></button>
      </form>
    </section>}
    <button type="button" className="stars-orb" aria-expanded={open} aria-controls={id} aria-label={open ? "Close STARS" : "Open STARS assistant"} onClick={() => { if (open) voice.current?.stop(); setOpen(!open); }}>
      <Wave state={open ? shownState : "idle"} /><span>STARS</span>
    </button>
  </div>;
}

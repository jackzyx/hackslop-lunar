import { grade, maskAt, MAX_DELAY_D, WINDOW_H } from "@/metrics.js";
import { data, sites, dur, latLon } from "@/lib/data.js";
import { useCountUp } from "@/lib/useCountUp.js";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS = { good: "NOMINAL", warning: "MARGINAL", critical: "CRITICAL" };

function nextEvent(m) {
  const ev = [["SUNSET IN", m.sunsetIn], ["EARTHSET IN", m.earthsetIn]].filter(([, h]) => h !== null);
  if (!ev.length) return ["NEXT SET", "BOTH DOWN"];
  const [name, h] = ev.reduce((a, b) => (b[1] < a[1] ? b : a));
  return h === Infinity ? ["NEXT SET", "NONE IN 30 D"] : [name, dur(h).toUpperCase()];
}

// One site's readout. st = { id, m (windowMetrics now), d (verdictDelay) }; i0 = landing hour index.
export default function SiteCard({ n, st, i0, onPick }) {
  const s = sites[st.id], e = data.ephemeris.sites[st.id], { m, d } = st;
  const g = grade(m.sunlit), shown = useCountUp(m.sunlit);
  const kind = s.kind && s.kind.toLowerCase() !== s.name.toLowerCase() ? s.kind : null; // the site type, unless the name says it
  const mission = [kind, s.mission ?? "Mission: pending Story's site list"].filter(Boolean).join(" · ");
  const el = e.sun_el[i0], margin = el - maskAt(s.horizon, e.sun_az[i0]);
  const deg = (x) => `${x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}°`;
  const verdict = d === null ? `Holds through a ${MAX_DELAY_D}-day delay` : d === 0 ? "Under half sunlight even on time" : `Falls below half sunlight with a ${d}-day delay`;
  const [evName, evVal] = nextEvent(m);
  const bar = (label, cls, h) => (
    <div className={`hbar ${cls}`}>
      <span className="hud-label">{label}</span>
      <span className="seg"><i style={{ width: `${((h / WINDOW_H) * 100).toFixed(1)}%` }} /></span>
      <b>{Math.round(h)} H</b>
    </div>
  );

  return (
    <Card className="hud site">
      <div className="flex items-center justify-between">
        <span className="hud-label">SITE {n}</span>
        <span className={`status ${g}`}>● {STATUS[g]}</span>
      </div>
      <Select value={st.id} onValueChange={onPick}>
        <SelectTrigger className="site-pick" aria-label={`Site ${n}`}><SelectValue /></SelectTrigger>
        <SelectContent className="hud-menu">
          {data.sites.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="mission">{mission}</p>
      <p className="hud-label">{latLon(s)} · MAST {s.mast_m} M</p>

      <div className={`big ${g}`}>
        <span className="glow" aria-hidden="true">{Math.round(shown)}</span>
        <span className="sr-only">{Math.round(m.sunlit)} hours of sunlight</span>
        <small>H / {WINDOW_H} SUNLIGHT · {Math.round((m.sunlit / WINDOW_H) * 100)} %</small>
      </div>
      <p className="hud-label -mt-1">in the 30 days after landing</p>

      {bar("SUN", "sun", m.sunlit)}
      {bar("EARTH", "earth", m.earth)}

      <p className="readout">AT LANDING · SUN EL {deg(el)} · {deg(Math.abs(margin))} {margin >= 0 ? "OVER" : "UNDER"} SKYLINE</p>
      <p className="verdict">{verdict}</p>
      <dl className="nums">
        <div><dt>LONGEST DARK GAP</dt><dd>{dur(m.darkGap).toUpperCase()}</dd></div>
        <div><dt>{evName}</dt><dd>{evVal}</dd></div>
      </dl>
    </Card>
  );
}

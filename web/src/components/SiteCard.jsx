import { grade, MAX_DELAY_D, WINDOW_H } from "@/domain/metrics.js";
import { data, sites, dur } from "@/lib/data.js";
import { useCountUp } from "@/lib/useCountUp.js";
import { Card } from "@/components/ui/card";
import HelpTip from '@/components/HelpTip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS = { good: "NOMINAL", warning: "MARGINAL", critical: "CRITICAL" };

export default function SiteCard({ n, st, onPick, onRemove }) {
  const s = sites[st.id], { m, d } = st;
  const g = grade(m.sunlit), shown = useCountUp(m.sunlit);
  const kind = s.kind && s.kind.toLowerCase() !== s.name.toLowerCase() ? s.kind : null; // the site type, unless the name says it
  const mission = s.custom ? `Custom site · ${Math.abs(s.lat).toFixed(3)}°S ${s.lon.toFixed(2)}°E · ground ${s.ground_m} m`
    : [kind, s.mission ?? "Mission: pending Story's site list"].filter(Boolean).join(" · ");
  const verdict = d === null ? `Holds through a ${MAX_DELAY_D}-day delay` : d === 0 ? "Under half sunlight even on time" : `Falls below half sunlight with a ${d}-day delay`;
  const bar = (label, cls, h) => (
    <div className={`hbar ${cls}`}>
      <span className="hud-label">{label}<HelpTip label={label === 'SUN' ? 'sunlight hours' : 'Earth contact hours'}>{label === 'SUN' ? 'Total sunlight over the 30 days after landing. Partial visibility of the Sun counts proportionally; this is not electrical power.' : 'Hours when Earth is above the local terrain skyline during the 30 days after landing. This measures line of sight, not a guaranteed radio connection.'}</HelpTip></span>
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
      {/* fixed-height block so cards keep their size whichever site is picked */}
      <div className="site-meta">
        <p className="mission" title={mission}>{mission}</p>
        <p className="caption">
          {s.custom ? <>500 m terrain horizon, lower fidelity · <button type="button" className="link-btn" onClick={() => onRemove(s.id)}>Remove</button></>
            : s.terrain_modelled === false ? "Smooth-sphere horizon · Terrain not modelled" : null}
        </p>
      </div>

      <div className={`big ${g}`}>
        <span className="glow" aria-hidden="true">{Math.round(shown)}</span>
        <span className="sr-only">{Math.round(m.sunlit)} hours of sunlight</span>
        <small>H / {WINDOW_H} SUNLIGHT · {Math.round((m.sunlit / WINDOW_H) * 100)} %</small>
      </div>
      <p className="hud-label -mt-1">in the 30 days after landing</p>

      {bar("SUN", "sun", m.sunlit)}
      {bar("EARTH", "earth", m.earth)}

      <p className="verdict">{verdict}</p>
      <dl className="nums">
        <div><dt>LONGEST DARK GAP<HelpTip label="longest dark gap">The longest uninterrupted stretch with no part of the Sun visible, within the 30 days after landing.</HelpTip></dt><dd>{dur(m.darkGap).toUpperCase()}</dd></div>
      </dl>
    </Card>
  );
}

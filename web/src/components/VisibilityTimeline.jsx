import { useEffect, useEffectEvent, useId, useMemo, useRef } from 'react';
import { WINDOW_H } from '@/domain/metrics.js';
import { TL } from '@/lib/charts.js';
import { t0, H, fmtDate } from '@/lib/data.js';

const scale = (TL.x1 - TL.x0) / WINDOW_H;
function intervals(values) {
  const result = [];
  let start = null;
  for (let i = 0; i <= values.length; i++) {
    const visible = i < values.length && values[i] > 0;
    if (visible && start === null) start = i;
    if (!visible && start !== null) { result.push([start, i]); start = null; }
  }
  return result;
}

export default function VisibilityTimeline({ visibility, i0, onShiftDate, ...events }) {
  const clip = useId();
  const timelineRef = useRef(null);
  const shiftDate = useEffectEvent((days) => onShiftDate(days));
  useEffect(() => {
    const timeline = timelineRef.current;
    let distance = 0;
    const resetDistance = () => { distance = 0; };
    const onWheel = (event) => {
      if (event.ctrlKey || event.metaKey || !event.target.closest('.timeline-bar') ||
          Math.abs(event.deltaY) <= Math.abs(event.deltaX) || !event.cancelable) return;
      event.preventDefault();
      const direction = Math.sign(event.deltaY);
      if (Math.sign(distance) !== direction) resetDistance();
      distance += event.deltaMode === 0 ? event.deltaY : direction * 100;
      const days = Math.trunc(distance / 100);
      if (days !== 0) {
        distance -= days * 100;
        shiftDate(days);
      }
    };
    timeline.addEventListener('wheel', onWheel, { passive: false });
    timeline.addEventListener('pointerleave', resetDistance);
    return () => {
      timeline.removeEventListener('wheel', onWheel);
      timeline.removeEventListener('pointerleave', resetDistance);
    };
  }, []);
  // Keep absolute visibility intervals mounted. Sliding a clipped strip preserves
  // each interval's identity, including while it enters or leaves the window.
  const rows = useMemo(() => [
    { label: 'SUN', cls: 'sun', y: 4, runs: intervals(visibility.sun) },
    { label: 'EARTH', cls: 'earth', y: 32, runs: intervals(visibility.earth) },
  ], [visibility]);
  return <svg ref={timelineRef} viewBox="0 0 600 84" role="img" aria-label="Sun and Earth over the 30 days" {...events}>
    <defs><clipPath id={clip}><rect x={TL.x0} y="0" width={TL.x1 - TL.x0} height="56" /></clipPath></defs>
    {rows.map(row => <g key={row.cls}>
      <text className="ink" x="0" y={row.y + 15}>{row.label}</text>
      <g className="timeline-bar">
        <rect className="track" x={TL.x0} y={row.y} width={TL.x1 - TL.x0} height="20" />
        <g clipPath={`url(#${clip})`}>
          <g className="visibility-strip" style={{ transform: `translateX(${-i0 * scale}px)` }}>
            {row.runs.map(([a, b]) => <rect key={a} className={row.cls} x={TL.x0 + a * scale} y={row.y} width={(b - a) * scale} height="20" />)}
          </g>
        </g>
      </g>
    </g>)}
    {[0, 5, 10, 15, 20, 25, 30].map(day => <text key={day} x={TL.x0 + day * 24 * scale} y="80" textAnchor={day === 0 ? 'start' : day === 30 ? 'end' : 'middle'}>{fmtDate(t0 + (i0 + day * 24) * H).toUpperCase()}</text>)}
  </svg>;
}

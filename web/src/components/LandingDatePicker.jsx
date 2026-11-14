import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';

const parse = value => new Date(`${value}T00:00:00Z`);
const iso = date => date.toISOString().slice(0, 10);
const monthOf = value => `${value.slice(0, 7)}-01`;
const format = (date, options) => date.toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });

export default function LandingDatePicker({ value, min, max, onChange }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value));
  const root = useRef(null), trigger = useRef(null), calendar = useRef(null);
  const id = useId();
  const date = parse(value), first = parse(month);
  const shiftMonth = amount => iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + amount, 1)));
  const previous = shiftMonth(-1), next = shiftMonth(1);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const close = () => { setOpen(false); trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    const frame = requestAnimationFrame(() => calendar.current?.querySelector(`[data-date="${value}"]`)?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, value]);

  function navigate(event, current) {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const target = parse(current); target.setUTCDate(target.getUTCDate() + delta);
    const key = iso(target);
    if (key < min || key > max) return;
    setMonth(monthOf(key));
    requestAnimationFrame(() => calendar.current?.querySelector(`[data-date="${key}"]`)?.focus());
  }

  return <div className="landing-picker" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <span className="hud-label" id={`${id}-label`}>PLANNED LANDING</span>
    <button type="button" className="landing-trigger" ref={trigger} aria-expanded={open} aria-controls={id}
      aria-haspopup="dialog" aria-label={`Planned landing ${format(date, { day: 'numeric', month: 'long', year: 'numeric' })}, 00:00 UTC`}
      onClick={() => { setMonth(monthOf(value)); setOpen(!open); }}>
      <span>{format(date, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
      <CalendarDays size={16} aria-hidden="true" />
    </button>
    {open && <div className="landing-calendar" id={id} role="dialog" aria-label="Choose planned landing date" ref={calendar}>
      <div className="calendar-heading">
        <button type="button" aria-label="Previous month" disabled={previous < monthOf(min)} onClick={() => setMonth(previous)}><ChevronLeft size={18} /></button>
        <span aria-live="polite">{format(first, { month: 'long', year: 'numeric' })}</span>
        <button type="button" aria-label="Next month" disabled={next > monthOf(max)} onClick={() => setMonth(next)}><ChevronRight size={18} /></button>
      </div>
      <div className="calendar-week" aria-hidden="true">{['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-days">
        {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const day = `${month.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
          return <button key={day} type="button" data-date={day} aria-label={format(parse(day), { day: 'numeric', month: 'long', year: 'numeric' })}
            aria-pressed={day === value} disabled={day < min || day > max}
            onKeyDown={event => navigate(event, day)} onClick={() => { onChange(day); close(); }}>{i + 1}</button>;
        })}
      </div>
      <div className="calendar-footer"><Clock3 size={14} aria-hidden="true" /><span>Landing time fixed at <strong>00:00 UTC</strong></span></div>
    </div>}
  </div>;
}

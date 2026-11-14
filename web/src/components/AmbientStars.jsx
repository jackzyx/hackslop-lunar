import { useEffect, useRef } from 'react';
import { createStars, drawStars } from '@/lib/starfield.js';
import { createConstellations, drawConstellations } from '@/lib/constellations.js';

export default function AmbientStars({ page }) {
  const canvas = useRef(null);
  const pageConstellations = useRef(new Map());
  useEffect(() => {
    const element = canvas.current, context = element.getContext('2d');
    if (!context) return;
    if (!pageConstellations.current.has(page)) pageConstellations.current.set(page, createConstellations());
    const constellations = pageConstellations.current.get(page);
    const constellationTopLimit = page === 'compare' ? 48 : 138;
    const intro = document.getElementById('intro');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0, y: 0, active: false };
    let stars, width, height, dpr, frame = 0, previous = 0, time = 0;

    function paint(now = 0) {
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 30;
      previous = now;
      if (!motion.matches) time += dt;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const activePointer = motion.matches ? null : pointer;
      drawStars(context, stars, width, height, time, dt, activePointer, motion.matches);
      drawConstellations(context, constellations, width, height, time, activePointer, constellationTopLimit);
    }
    function tick(now) {
      frame = requestAnimationFrame(tick);
      if (!previous || now - previous >= 1000 / 30) paint(now);
    }
    function sync() {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      const ready = !intro || intro.hidden;
      element.dataset.visible = String(ready);
      if (!ready || document.hidden) return;
      paint();
      if (!motion.matches) frame = requestAnimationFrame(tick);
    }
    function resize() {
      width = innerWidth; height = innerHeight;
      dpr = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(2.5e6 / (width * height)));
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
      stars = createStars(Math.min(180, Math.max(60, Math.round(width * height / 14000))));
      sync();
    }
    const move = event => {
      if (event.pointerType === 'touch' || motion.matches) return;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true;
    };
    const leave = event => { if (!event.relatedTarget) pointer.active = false; };
    const blur = () => { pointer.active = false; };
    const observer = new MutationObserver(sync);
    if (intro) observer.observe(intro, { attributes: true, attributeFilter: ['hidden'] });
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerout', leave, { passive: true });
    addEventListener('blur', blur);
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    resize();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      removeEventListener('pointermove', move); removeEventListener('pointerout', leave);
      removeEventListener('blur', blur); removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync);
    };
  }, [page]);
  return <canvas ref={canvas} className="site-starfield" aria-hidden="true" data-visible="false" />;
}

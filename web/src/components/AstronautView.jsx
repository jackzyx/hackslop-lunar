import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadRegionalTerrain } from '@/terrain/regional-terrain.js';
import { loadSurfaceTerrain, surfaceFrame, surfaceMesh, surfacePanorama } from '@/terrain/surface-terrain.js';

export default function AstronautView({ location, terrain, onClose }) {
  const dialog = useRef(null), canvas = useRef(null);
  const draw = useRef(null), drag = useRef(null);
  const [phase, setPhase] = useState('loading');
  const [bearing, setBearing] = useState(0);
  const [closing, setClosing] = useState(false);

  // Play the collapse animation, then unmount; reduced motion closes at once.
  function close() {
    if (closing) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) onClose();
    else setClosing(true);
  }
  const finish = useEffectEvent(() => onClose());
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(finish, 560);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    const modal = dialog.current;
    modal.showModal();
    return () => {
      modal.close();
      if (location.trigger?.isConnected) location.trigger.focus({ preventScroll: true });
    };
  }, [location]);

  useEffect(() => {
    const element = canvas.current;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
    const toLocal = surfaceFrame(location.x, location.y);
    let renderer, frame, observer, camera, pending = false, ready = false;
    function repaint() {
      if (pending || !ready || controller.signal.aborted) return;
      pending = true;
      frame = requestAnimationFrame(() => {
        pending = false;
        renderer.draw(camera);
      });
    }
    function lost(e) {
      e.preventDefault();
      cancelAnimationFrame(frame);
      ready = false;
      draw.current = null;
      setPhase('error');
    }
    element.addEventListener('webglcontextlost', lost);
    async function start() {
      const [detail, regional, { createSurfaceRenderer, descentCamera }] = await Promise.all([
        loadSurfaceTerrain(location.x, location.y, signal), loadRegionalTerrain(), import('@/terrain/surface-renderer.js'),
      ]);
      if (controller.signal.aborted) return;
      const scene = { ...location, terrain, regional, detail };
      const mesh = surfaceMesh(scene);
      const arrival = surfacePanorama(scene);
      renderer = createSurfaceRenderer(element, mesh, toLocal(location.sun), toLocal(location.earth));
      observer = new ResizeObserver(repaint);
      observer.observe(element);
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reducedMotion ? 0 : 2450;
      if (duration) setPhase('descending');
      const start = performance.now();
      function animate(now) {
        const progress = duration ? Math.max(0, Math.min(1, (now - start) / duration)) : 1;
        camera = descentCamera(location, arrival, progress);
        renderer.draw(camera);
        if (progress < 1) frame = requestAnimationFrame(animate);
        else {
          ready = true;
          function look(dx, dy) {
            camera.yaw = (camera.yaw + dx + 360) % 360;
            camera.pitch = Math.min(82, Math.max(-82, camera.pitch + dy));
            setBearing((Math.round(camera.yaw - location.lon) + 360) % 360);
            repaint();
          }
          draw.current = look;
          look(0, 0);
          setPhase('ready');
        }
      }
      animate(start);
    }
    start().catch(() => { if (!controller.signal.aborted) setPhase('error'); });
    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      observer?.disconnect();
      element.removeEventListener('webglcontextlost', lost);
      renderer?.dispose();
      draw.current = null;
    };
  }, [location, terrain]);

  function startLook(e) {
    if (phase !== 'ready' || e.button !== 0 || drag.current) return;
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  function moveLook(e) {
    const point = drag.current;
    if (point?.id !== e.pointerId) return;
    draw.current?.((point.x - e.clientX) * .22, (e.clientY - point.y) * .22);
    point.x = e.clientX;
    point.y = e.clientY;
  }
  function endLook(e) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }
  function keyLook(e) {
    const arrows = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 4], ArrowDown: [0, -4] };
    if (!draw.current || !arrows[e.key]) return;
    e.preventDefault();
    draw.current(...arrows[e.key]);
  }

  return <dialog ref={dialog} className="astronaut-view" aria-labelledby="astronaut-title"
    data-closing={closing || undefined} onCancel={e => { e.preventDefault(); close(); }}>
    <div className="astronaut-header">
      <div>
        <h2 id="astronaut-title" className="hud-title">ASTRONAUT VIEW</h2>
        <p>{location.name}</p>
      </div>
      <Button type="button" variant="outline" size="sm" autoFocus onClick={close}>
        <ArrowLeftIcon aria-hidden="true" /> BACK TO MAP
      </Button>
    </div>
    <div className="astronaut-scene" data-phase={phase}>
      <canvas ref={canvas} tabIndex={phase === 'ready' ? 0 : -1} aria-label="Lunar surface. Drag or use the arrow keys to look around."
        onPointerDown={startLook} onPointerMove={moveLook} onPointerUp={endLook} onLostPointerCapture={endLook} onKeyDown={keyLook} />
      {phase === 'ready' && <span className="map-hud astronaut-heading">{String(bearing).padStart(3, '0')}° · EYE LEVEL 1.7 M</span>}
      {phase !== 'ready' && <p className="astronaut-status" role="status">{
        { loading: 'Loading detailed lunar terrain…', descending: 'Descending to the surface', error: 'The surface view could not load. Check that WebGL 2 is available and try reopening it.' }[phase]
      }</p>}
    </div>
    <div className="astronaut-footer">
      <span>NASA LRO / LOLA · 80 m elevation near site · Sun and Earth from the ephemeris · simulated texture</span>
      <span>Drag or use arrow keys to look around</span>
    </div>
  </dialog>;
}

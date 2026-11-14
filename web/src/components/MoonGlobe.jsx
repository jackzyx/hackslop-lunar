import { useEffect, useRef } from 'react';
import { createMoonRenderer } from '@/lib/moon-globe.js';

const orbitRadius = 0.47;
const orbitSpeed = 2 * Math.PI / 20000;
const returnDuration = 460;
const followTime = 22;
const followTolerance = 0.0003;
const startAngle = -2.45;
const orbitPoint = angle => [0.5 + orbitRadius * Math.cos(angle), 0.5 + orbitRadius * Math.sin(angle)];
const defaultSun = orbitPoint(startAngle);
const arrowSteps = {
  ArrowLeft: [-0.05, 0],
  ArrowRight: [0.05, 0],
  ArrowUp: [0, -0.05],
  ArrowDown: [0, 0.05],
};

export default function MoonGlobe({ paused }) {
  const scene = useRef(null);
  const canvas = useRef(null);
  const marker = useRef(null);
  const position = useRef(defaultSun);
  const target = useRef(null);
  const isPaused = useRef(paused);
  const requestDraw = useRef(null);
  const touchRelease = useRef(null);

  useEffect(() => {
    isPaused.current = paused;
    requestDraw.current?.();
  }, [paused]);

  useEffect(() => {
    const renderer = createMoonRenderer(canvas.current);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const globe = scene.current;
    const sun = marker.current;

    let frame = null;
    let visible = true;
    let previousTime = null;
    let angle = startAngle;
    let wasTracking = false;
    let returnFrom = null;
    let returnTime = 0;

    function requestFrame() {
      if (visible && frame === null) frame = requestAnimationFrame(draw);
    }

    function draw(time) {
      frame = null;
      const tracking = target.current;
      const animate = !isPaused.current && !reducedMotion.matches;
      const elapsed = previousTime === null ? 0 : Math.min(time - previousTime, 50);
      let following = false;

      if (tracking) {
        const blend = animate ? 1 - Math.exp(-(elapsed || 1000 / 60) / followTime) : 1;
        const next = position.current.map((coordinate, index) => coordinate + (tracking[index] - coordinate) * blend);
        following = Math.hypot(tracking[0] - next[0], tracking[1] - next[1]) > followTolerance;
        position.current = following ? next : tracking;
        returnFrom = null;
      } else {
        if (wasTracking) {
          returnFrom = position.current;
          returnTime = 0;
          angle = Math.atan2(returnFrom[1] - 0.5, returnFrom[0] - 0.5);
        }
        if (animate) angle += orbitSpeed * elapsed;
        let next = orbitPoint(angle);
        if (returnFrom && animate) {
          returnTime += elapsed;
          const progress = Math.min(1, returnTime / returnDuration);
          const blend = progress * progress * (3 - 2 * progress);
          next = next.map((coordinate, index) => returnFrom[index] + (coordinate - returnFrom[index]) * blend);
          if (progress === 1) returnFrom = null;
        } else {
          returnFrom = null;
        }
        position.current = next;
      }

      const [x, y] = position.current;
      sun.style.left = `${x * 100}%`;
      sun.style.top = `${y * 100}%`;
      renderer?.render(x, y);
      wasTracking = Boolean(tracking);
      const keepDrawing = following || (!tracking && animate);
      previousTime = keepDrawing ? time : null;
      if (keepDrawing) requestFrame();
    }

    requestDraw.current = requestFrame;
    draw(performance.now());

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      previousTime = null;
      if (visible) requestFrame();
      else if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    });
    observer?.observe(globe);
    reducedMotion.addEventListener('change', requestFrame);

    function releaseMouse() {
      returnToOrbit('mouse');
    }

    function trackMouse(event) {
      if (!visible || !event.isPrimary || event.pointerType !== 'mouse') return;
      const { left, top, width, height } = globe.getBoundingClientRect();
      if (!width || !height) return;

      const x = event.clientX - left;
      const y = event.clientY - top;
      const distance = Math.hypot(Math.max(0, -x, x - width), Math.max(0, -y, y - height));
      const range = Math.min(width * 0.25, 110);
      const allowance = globe.dataset.input === 'mouse' ? 16 : 0;
      if (distance <= range + allowance) {
        const markerRadius = 9;
        const cursorX = Math.max(markerRadius, Math.min(document.documentElement.clientWidth - markerRadius, event.clientX));
        const cursorY = Math.max(markerRadius, Math.min(document.documentElement.clientHeight - markerRadius, event.clientY));
        moveSun((cursorX - left) / width, (cursorY - top) / height, 'mouse');
      } else {
        releaseMouse();
      }
    }

    function releaseMouseAtWindowEdge(event) {
      if (event.pointerType === 'mouse' && event.relatedTarget === null) releaseMouse();
    }

    window.addEventListener('pointermove', trackMouse);
    window.addEventListener('pointerout', releaseMouseAtWindowEdge);
    window.addEventListener('blur', releaseMouse);
    window.addEventListener('scroll', releaseMouse, { passive: true });

    const texture = new Image();
    texture.onload = () => {
      renderer?.setTexture(texture);
      requestDraw.current?.();
    };
    texture.src = new URL('moon-albedo-4k.jpg', document.baseURI).href;

    return () => {
      texture.onload = null;
      requestDraw.current = null;
      clearTimeout(touchRelease.current);
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      reducedMotion.removeEventListener('change', requestFrame);
      window.removeEventListener('pointermove', trackMouse);
      window.removeEventListener('pointerout', releaseMouseAtWindowEdge);
      window.removeEventListener('blur', releaseMouse);
      window.removeEventListener('scroll', releaseMouse);
    };
  }, []);

  function moveSun(x, y, mode) {
    clearTimeout(touchRelease.current);
    target.current = mode === 'mouse' ? [x, y] : [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
    scene.current.dataset.input = mode;
    requestDraw.current?.();
  }

  function movePointer(event) {
    if (!event.isPrimary || event.pointerType === 'mouse') return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    moveSun((event.clientX - left) / width, (event.clientY - top) / height, event.pointerType);
  }

  function moveKeyboard(event) {
    if (event.key === 'Home') {
      event.preventDefault();
      moveSun(...defaultSun, 'keyboard');
    } else if (Object.hasOwn(arrowSteps, event.key)) {
      event.preventDefault();
      const [dx, dy] = arrowSteps[event.key];
      const [x, y] = target.current ?? position.current;
      moveSun(x + dx, y + dy, 'keyboard');
    }
  }

  function returnToOrbit(mode) {
    if (scene.current.dataset.input !== mode) return;
    target.current = null;
    delete scene.current.dataset.input;
    requestDraw.current?.();
  }

  return <figure className="about-moon">
    <div ref={scene} className="about-moon-scene" role="group" tabIndex={0} aria-label="Interactive Moon lighting" aria-describedby="about-moon-help"
      onPointerEnter={event => { if (event.pointerType === 'pen') movePointer(event); }} onPointerMove={movePointer} onPointerDown={movePointer}
      onPointerLeave={event => { if (event.pointerType === 'pen') returnToOrbit('pen'); }}
      onPointerCancel={event => returnToOrbit(event.pointerType)}
      onPointerUp={event => {
        if (event.isPrimary && event.pointerType === 'touch') {
          touchRelease.current = setTimeout(() => returnToOrbit('touch'), 400);
        }
      }} onKeyDown={moveKeyboard} onBlur={() => returnToOrbit('keyboard')}>
      <canvas ref={canvas} width="600" height="600" role="img" aria-label="Three-dimensional Moon globe with NASA lunar imagery" />
      <span ref={marker} className="about-sun-marker" aria-hidden="true" />
    </div>
    <figcaption hidden id="about-moon-help">Move your pointer or tap to place the Sun. Use the arrow keys when focused.</figcaption>
  </figure>;
}

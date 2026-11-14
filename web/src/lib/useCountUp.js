import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/data.js";

// The shown number eases from its last value to the new one (~0.4 s) when a slip changes it.
export function useCountUp(target, ms = 400) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reducedMotion()) { from.current = target; setShown(target); return; }
    const a = from.current, start = performance.now();
    let raf = 0;
    const step = (now) => {
      const x = Math.min(1, (now - start) / ms), v = a + (target - a) * (1 - (1 - x) ** 3);
      from.current = v;
      setShown(v);
      if (x < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

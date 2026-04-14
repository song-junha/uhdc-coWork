import { useEffect } from 'react';

const BASE_WIDTH = 420;
const MIN_SCALE = 1;
const MAX_SCALE = 1.8;

export function useWindowScale() {
  useEffect(() => {
    let rafId: number;

    const update = () => {
      // outerWidth는 CSS zoom 영향을 받지 않아 feedback loop 방지
      const w = window.outerWidth;
      if (w <= 0) return;
      const scale = Math.min(Math.max(w / BASE_WIDTH, MIN_SCALE), MAX_SCALE);
      document.documentElement.style.setProperty('zoom', String(scale));
    };

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener('resize', handleResize);
    update();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);
}

import { useEffect, useRef } from 'react';

export function useParallax<T extends HTMLElement = HTMLDivElement>(strength = 0.08) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (node) node.style.transform = 'none';
      return;
    }

    let frame = 0;

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const viewportH = window.innerHeight;
        // Skip calculation if completely outside viewport
        if (rect.bottom < -120 || rect.top > viewportH + 120) return;
        const center = rect.top + rect.height / 2;
        const distance = center - viewportH / 2;
        // Limit max displacement on small devices to prevent overflow
        const maxOffset = window.innerWidth < 640 ? 24 : 64;
        const rawTranslate = distance * strength;
        const translateY = Math.max(-maxOffset, Math.min(maxOffset, Math.round(rawTranslate)));
        node.style.transform = `translate3d(0, ${translateY}px, 0)`;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [strength]);

  return ref;
}

import { useEffect, useRef } from 'react';

export function useParallax<T extends HTMLElement = HTMLDivElement>(strength = 0.15) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let frame = 0;

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const viewportH = window.innerHeight;
        if (rect.bottom < 0 || rect.top > viewportH) return;
        const center = rect.top + rect.height / 2;
        const distance = center - viewportH / 2;
        node.style.transform = `translateY(${distance * strength}px)`;
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

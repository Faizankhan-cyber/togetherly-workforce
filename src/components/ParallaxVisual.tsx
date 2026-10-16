import type { ReactNode } from 'react';

interface ParallaxVisualProps {
  strength?: number;
  className?: string;
  children?: ReactNode;
}

export function ParallaxVisual({ children }: ParallaxVisualProps) {
  // Enterprise clean: suppress decorative blur background orbs
  if (!children) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none select-none">
      {children}
    </div>
  );
}

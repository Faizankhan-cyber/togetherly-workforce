import type { ReactNode } from 'react';
import { useParallax } from '@/hooks/useParallax';

interface ParallaxVisualProps {
  strength?: number;
  className?: string;
  children?: ReactNode;
}

export function ParallaxVisual({ strength = 0.08, className = '', children }: ParallaxVisualProps) {
  const ref = useParallax<HTMLDivElement>(strength);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`will-change-transform pointer-events-none select-none transition-transform duration-75 ease-out ${className}`}
    >
      {children}
    </div>
  );
}

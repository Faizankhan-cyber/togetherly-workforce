import type { ReactNode } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

export interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li' | 'span';
  threshold?: number;
  rootMargin?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'none';
  duration?: number;
}

export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
  threshold = 0.1,
  rootMargin = '0px 0px -40px 0px',
  direction = 'up',
  duration = 650,
}: RevealProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold,
    rootMargin,
    delay,
  });

  const hiddenClass = `reveal-hidden-${direction}`;

  return (
    <Tag
      ref={ref}
      style={{
        transitionDuration: `${duration}ms`,
      }}
      className={`reveal-transition ${isVisible ? 'reveal-visible' : hiddenClass} ${className}`}
    >
      {children}
    </Tag>
  );
}

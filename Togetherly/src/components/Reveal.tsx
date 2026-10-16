import type { ReactNode } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li' | 'span';
  threshold?: number;
  rootMargin?: string;
}

export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
  threshold = 0.15,
  rootMargin = '0px 0px -60px 0px',
}: RevealProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold,
    rootMargin,
    delay,
  });

  return (
    <Tag
      ref={ref}
      className={`reveal-transition ${isVisible ? 'reveal-visible' : 'reveal-hidden'} ${className}`}
    >
      {children}
    </Tag>
  );
}

import React, { type ReactNode } from 'react';
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
  threshold = 0.05,
  rootMargin = '0px 0px -20px 0px',
  direction = 'up',
  duration = 600,
}: RevealProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold,
    rootMargin,
  });

  const hiddenClass = `reveal-hidden-${direction}`;

  return React.createElement(
    Tag,
    {
      ref,
      style: {
        transitionDuration: `${duration}ms`,
        transitionDelay: isVisible ? `${delay}ms` : '0ms',
      },
      className: `reveal-transition ${isVisible ? 'reveal-visible' : hiddenClass} ${className}`,
    },
    children
  );
}

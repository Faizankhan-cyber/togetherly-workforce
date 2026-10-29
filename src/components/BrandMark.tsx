type BrandMarkProps = {
  className?: string;
  decorative?: boolean;
};

export function BrandMark({ className = '', decorative = true }: BrandMarkProps) {
  return (
    <img
      src="/togetherly-mark.svg"
      alt={decorative ? '' : 'Togetherly'}
      aria-hidden={decorative}
      draggable={false}
      className={`object-contain ${className}`.trim()}
    />
  );
}

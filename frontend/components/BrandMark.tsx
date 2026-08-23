type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 32, className }: BrandMarkProps) {
  return (
    <span
      className={`brand-mark${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img src="/brand/mark.png" alt="" width={size} height={size} />
    </span>
  );
}

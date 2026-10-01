type BrandMarkProps = Readonly<{
  className?: string;
}>;

export function BrandMark({ className }: BrandMarkProps) {
  const classes = className === undefined ? 'brand-mark' : `brand-mark ${className}`;

  return <span className={classes}>알뜰</span>;
}

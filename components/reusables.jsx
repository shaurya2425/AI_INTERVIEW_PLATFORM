export const GrayTitle = ({ children }) => (
  <span className="bg-linear-to-br from-heading-start via-heading-middle to-heading-end bg-clip-text text-transparent">
    {children}
  </span>
);

export const GoldTitle = ({ children }) => (
    <span className="bg-linear-to-br from-gold-start via-gold-middle to-gold-end bg-clip-text text-transparent" >{children}</span>
);

export const SectionLabel = ({ children }) => (
    <p className="inline-flex items-center gap-2 text-xs font-semibold text-brand tracking-[0.14em] uppercase mb-4">
        <span className="w-4 h-px bg-amber-400" />
        {children}
    </p>
);

export const SectionHeading = ({ gray, gold }) => (
  <h2
    className={`font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.1] tracking-[-0.025em]`}
  >
    <GrayTitle>{gray}</GrayTitle>
    <br />
    <GoldTitle>{gold}</GoldTitle>
  </h2>
);

export default function PageHeader({ label, gray, gold, description, right }) {
  return (
    <div className="border-b border-border px-8 py-10">
      <div className="max-w-6xl mx-auto flex flex-col items-start sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {label && <SectionLabel>{label}</SectionLabel>}
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mt-1">
            {gray && <GrayTitle>{gray} </GrayTitle>}
            {gold && <GoldTitle>{gold}</GoldTitle>}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground font-light mt-2">
              {description}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}

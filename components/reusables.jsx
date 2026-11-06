export const GrayTitle = ({ children }) => (
  <span className="bg-linear-to-br from-stone-100 via-stone-300 to-stone-500 bg-clip-text text-transparent">
    {children}
  </span>
);

export const GoldTitle = ({ children }) => (
    <span className="bg-linear-to-br from-amber-300 via-amber-400 to-amber-600 bg-clip-text text-transparent" >{children}</span>
);

export const SectionLabel = ({ children }) => (
    <p className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-[0.14em] uppercase mb-4">
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
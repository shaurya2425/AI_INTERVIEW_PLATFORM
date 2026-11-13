import React from "react";

const BentoCard = ({ icon, title, desc, children, className = "" }) => {
  return (
    <div
      className={`relative h-full overflow-hidden rounded-2xl border border-border bg-card p-9 transition duration-300 hover:border-amber-400/20 ${className}`}
    >
      <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-xl">
        {icon}
      </span>

      <h3 className="mb-2 font-serif text-xl tracking-tight">{title}</h3>

      <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>

      {children}
    </div>
  );
};

export default BentoCard;
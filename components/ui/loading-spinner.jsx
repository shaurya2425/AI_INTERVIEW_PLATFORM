import { cn } from "@/lib/utils";

export function LoadingSpinner({ label = "Loading", className }) {
  return (
    <span role="status" className="inline-flex shrink-0 items-center justify-center">
      <span
        aria-hidden="true"
        className={cn(
          "size-5 rounded-full border-2 border-current border-t-transparent text-brand animate-spin motion-reduce:animate-none",
          className,
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = "Loading page", className }) {
  return (
    <div className={cn("flex min-h-[60vh] w-full items-center justify-center px-6", className)}>
      <LoadingSpinner label={label} className="size-9 border-[3px]" />
    </div>
  );
}

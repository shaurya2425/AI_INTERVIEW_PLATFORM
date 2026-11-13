"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const message = "Unable to load this page. Please try again.";

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    toast.error(message, { id: "page-load-error" });
    return () => { toast.dismiss("page-load-error"); };
  }, [error]);

  return (
    <section className="min-h-[70vh] px-6 pt-28 flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-serif text-3xl">Something went wrong</h1>
      <p role="alert" className="text-muted-foreground">{message}</p>
      <Button onClick={() => { toast.dismiss("page-load-error"); reset(); }}>Try again</Button>
    </section>
  );
}

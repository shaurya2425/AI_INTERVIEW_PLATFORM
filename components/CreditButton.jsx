"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";
import UpgradeModal from "./UpgradeModal";
import { Button } from "./ui/button";

export default function CreditButton({ role, credits }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    if (role === "INTERVIEWER") {
      router.push("/dashboard");
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="border-amber-400/20 text-brand cursor-pointer"
        onClick={handleClick}
      >
        <Coins size={14} />
        <span>
          {credits} <span className="sr-only sm:not-sr-only">{role === "INTERVIEWER" ? "Earned" : "Credits"}</span>
        </span>
      </Button>

      <UpgradeModal open={open} onOpenChange={setOpen} />
    </>
  );
}

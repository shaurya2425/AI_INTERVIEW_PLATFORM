"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncClerkProfile } from "@/actions/user";
import { getClerkDisplayName } from "@/lib/user-name";

export default function ClerkProfileSync({ clerkUserId, name, imageUrl }) {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const [retry, setRetry] = useState(0);
  const synced = useRef(null);
  const profileKey = isLoaded && user?.id === clerkUserId
    ? JSON.stringify([user.id, getClerkDisplayName(user), user.imageUrl || null])
    : null;
  const savedKey = JSON.stringify([clerkUserId, name, imageUrl || null]);

  useEffect(() => {
    if (!profileKey || profileKey === savedKey) {
      synced.current = null;
      return;
    }
    if (synced.current === profileKey) return;
    let cancelled = false;
    // Batch changes from Manage account without polling Clerk or the database.
    const timer = setTimeout(async () => {
      try {
        const result = await syncClerkProfile();
        if (cancelled) return;
        if (!result?.success) throw new Error(result?.error || "Unable to sync your profile.");
        synced.current = profileKey;
        toast.dismiss("profile-sync-error");
        router.refresh();
      } catch (error) {
        if (cancelled) return;
        toast.error(error.message || "Unable to sync your profile. Please try again.", {
          id: "profile-sync-error",
          action: { label: "Retry", onClick: () => setRetry((value) => value + 1) },
        });
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [profileKey, savedKey, retry, router]);

  return null;
}

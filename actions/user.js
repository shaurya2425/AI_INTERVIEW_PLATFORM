"use server";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getClerkDisplayName } from "@/lib/user-name";
import { getClerkProfileUpdates } from "@/lib/clerk-profile";
import { actionFailure, runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

export const syncClerkProfile = async () => runAction(async () => {
  // Read the signed-in user's profile from Clerk; accept no client-supplied ID or fields.
  const user = await currentUser();
  if (!user) return actionFailure("Please sign in to sync your profile.");
  const existing = await db.user.findUnique({ where: { clerkUserId: user.id } });
  if (!existing) return actionFailure("Your profile is not ready yet. Refresh the page and try again.");
  const updates = getClerkProfileUpdates(existing, user);
  if (Object.keys(updates).length) {
    await db.user.update({ where: { clerkUserId: user.id }, data: updates });
  }
  // Also refresh if the header's fallback sync already updated the database.
  revalidatePath("/", "layout");
  return { success: true };
}, "Your Clerk changes were saved, but your public profile could not sync. Please try again.");

export const getCurrentUser = async () => {
  const user = await currentUser();
  if (!user) return null;

  const dbUser = await db.user.findUnique({
    where: { clerkUserId: user.id },
    select: {
      role: true,
      name: true,
      title: true,
      company: true,
      imageUrl: true,
    },
  });
  return dbUser ? { ...dbUser, name: getClerkDisplayName(user) } : null;
};

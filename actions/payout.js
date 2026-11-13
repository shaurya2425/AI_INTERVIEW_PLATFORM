// Assignment

"use server";

import { actionFailure, runAction } from "@/lib/action-result";

import { db } from "@/lib/prisma";

export const approvePayout = async ({ payoutId, adminPassword }) => runAction(async () => {
  if (!adminPassword) return actionFailure("Password required");

  if (adminPassword !== process.env.ADMIN_PAYOUT_PASSWORD) {
    return actionFailure("Incorrect password");
  }

  const payout = await db.payout.findUnique({ where: { id: payoutId } });

  if (!payout) return actionFailure("Payout not found");
  if (payout.status === "PROCESSED") return actionFailure("Already processed");

  await db.payout.update({
    where: { id: payoutId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      processedBy: "admin",
    },
  });

  return { success: true };
}, "Unable to approve the payout. Please try again.");
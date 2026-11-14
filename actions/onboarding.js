"use server";

import { actionFailure, runAction } from "@/lib/action-result";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";

export const completeOnboarding = async (data) => runAction(async () => {
  const user = await currentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  const { role, title, company, yearsExp, bio, categories } = data;

  if (!role || !["INTERVIEWEE", "INTERVIEWER"].includes(role)) {
    return actionFailure("Invalid role");
  }

  if (role === "INTERVIEWER") {
    if (!title || !company || !yearsExp || !bio || !categories?.length) {
      return actionFailure("Please fill in all required fields");
    }
  }

  try {
    await db.user.update({
      where: { clerkUserId: user.id },
      data: {
        role,
        ...(role === "INTERVIEWER" && {
          title,
          company,
          yearsExp,
          bio,
          categories,
        }),
      },
    });

    // Header's RoleRedirect lives in the shared root layout. Refresh its role
    // before navigating so an old UNASSIGNED value cannot send users back.
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Onboarding error:", error);
    return actionFailure("Something went wrong. Please try again.");
  }
}, "Unable to save your profile. Please try again.");

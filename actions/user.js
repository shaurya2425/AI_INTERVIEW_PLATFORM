"use server";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getClerkDisplayName } from "@/lib/user-name";

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

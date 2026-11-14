
import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { withDisplayName } from "@/lib/user-name";

export const getInterviewers = async () => {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const interviewers = await db.user.findMany({
    where: {
      role: "INTERVIEWER",
      ...(user && {
        clerkUserId: {
          not: user.id,
        },
      }),
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      title: true,
      company: true,
      yearsExp: true,
      bio: true,
      categories: true,
      creditRate: true,
      availabilities: {
        where: {
          status: "AVAILABLE",
        },
        select: {
          startTime: true,
          endTime: true,
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return interviewers.map(withDisplayName);
};

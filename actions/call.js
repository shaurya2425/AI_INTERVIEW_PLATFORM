
import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getClerkDisplayName, withDisplayName } from "@/lib/user-name";
import { StreamClient } from "@stream-io/node-sdk";

export const getCallData = async (callId) => {
  // 1. Validate input
  if (!callId || typeof callId !== "string") {
    return { error: "Call not found" };
  }

  // 2. Verify authentication
  const user = await currentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // 3. Find the booking
  const booking = await db.booking.findUnique({
    where: {
      streamCallId: callId,
    },
    include: {
      interviewer: {
        select: {
          id: true,
          clerkUserId: true,
          name: true,
          imageUrl: true,
          categories: true,
        },
      },
      interviewee: {
        select: {
          id: true,
          clerkUserId: true,
          name: true,
          imageUrl: true,
        },
      },
    },
  });

  if (!booking) {
    return { error: "Call not found" };
  }

  // 4. Verify booking ownership
  const isInterviewer =
    booking.interviewer.clerkUserId === user.id;

  const isInterviewee =
    booking.interviewee.clerkUserId === user.id;

  if (!isInterviewer && !isInterviewee) {
    return { error: "Forbidden" };
  }

  // 5. Validate Stream credentials
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const apiSecret = process.env.STREAM_SECRET_KEY;

  if (!apiKey || !apiSecret) {
    throw new Error("Stream credentials are not configured");
  }

  // 6. Generate token only for an authorized user
  const streamClient = new StreamClient(
    apiKey,
    apiSecret
  );

  const token = streamClient.generateUserToken({
    user_id: user.id,
    validity_in_seconds: 60 * 60,
  });

  // 7. Return only the required data
  return {
    token,
    isInterviewer,

    currentUser: {
      id: user.id,
      name: getClerkDisplayName(user),
      imageUrl: user.imageUrl,
    },

    booking: {
      id: booking.id,
      interviewer: withDisplayName(booking.interviewer),
      interviewee: withDisplayName(booking.interviewee),
      categories: booking.interviewer.categories,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
    },
  };
};

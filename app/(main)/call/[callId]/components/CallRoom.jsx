
"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  CallingState,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

import { PageLoader } from "@/components/ui/loading-spinner";
import CallUI from "./CallUI";

export default function CallRoom({
  callId,
  token,
  apiKey,
  currentUser,
  booking,
  isInterviewer,
}) {
  const router = useRouter();

  const [videoClient, setVideoClient] = useState(null);
  const [call, setCall] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let client;
    let callInstance;

    const connect = async () => {
      try {
        client = new StreamVideoClient({
          apiKey,
          user: {
            id: currentUser.id,
            name: currentUser.name,
            image: currentUser.imageUrl,
          },
          token,
        });

        callInstance = client.call("default", callId);

        // Avoid camera conflicts when testing two accounts
        // on the same laptop.
        //
        // Interviewer:
        //   Use existing Stream camera/microphone settings.
        //
        // Interviewee:
        //   Join with camera and microphone disabled.
        //   Devices can be enabled later using call controls.

        if (!isInterviewer) {
          await callInstance.camera.disable();
          await callInstance.microphone.disable();
        }

        await callInstance.join({ create: false });

        if (cancelled) return;

        setConnectionError(null);
        setVideoClient(client);
        setCall(callInstance);
      } catch (error) {
        console.error("Call connection error:", error);

        if (cancelled) return;

        const message =
          error?.name === "NotReadableError"
            ? "Your camera or microphone is being used by another application. Close the other application or join with devices off."
            : "Unable to join the interview. Check your connection and try again.";

        setConnectionError(message);

        toast.error(message, {
          id: "call-connection-error",
        });
      }
    };

    const connection = connect();

    return () => {
      cancelled = true;

      // Wait for an in-progress join before cleanup.
      void connection.then(async () => {
        if (
          callInstance &&
          callInstance.state.callingState !== CallingState.LEFT
        ) {
          await callInstance.leave().catch(() => {});
        }

        await client?.disconnectUser().catch(() => {});
      });
    };
  }, [
    apiKey,
    callId,
    currentUser.id,
    currentUser.imageUrl,
    currentUser.name,
    token,
    isInterviewer,
  ]);

  const handleLeave = useCallback(() => {
    router.push(
      isInterviewer ? "/dashboard" : "/appointments"
    );
    router.refresh();
  }, [isInterviewer, router]);

  if (connectionError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p
          role="alert"
          className="max-w-md text-sm text-danger"
        >
          {connectionError}
        </p>

        <Button onClick={() => window.location.reload()}>
          Try again
        </Button>

        <Button variant="outline" onClick={handleLeave}>
          Back to appointments
        </Button>
      </div>
    );
  }

  if (!videoClient || !call) {
    return (
      <PageLoader
        label="Connecting to call"
        className="min-h-screen"
      />
    );
  }

  return (
    <StreamVideo client={videoClient}>
      <StreamCall call={call}>
        <CallUI
          callId={callId}
          isInterviewer={isInterviewer}
          booking={booking}
          onLeave={handleLeave}
          apiKey={apiKey}
          token={token}
          currentUser={currentUser}
        />
      </StreamCall>
    </StreamVideo>
  );
}

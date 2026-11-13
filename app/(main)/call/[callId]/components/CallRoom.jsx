"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Stream Video
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

import { Loader2 } from "lucide-react";
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
          user: { id: currentUser.id, name: currentUser.name, image: currentUser.imageUrl },
          token,
        });
        callInstance = client.call("default", callId);
        await callInstance.join({ create: false });
        if (cancelled) return;
        setConnectionError(null);
        setVideoClient(client);
        setCall(callInstance);
      } catch {
        if (cancelled) return;
        const message = "Unable to join the interview. Check your connection and camera/microphone permissions, then try again.";
        setConnectionError(message);
        toast.error(message, { id: "call-connection-error" });
      }
    };
    const connection = connect();

    return () => {
      cancelled = true;
      // Wait for a pending join before cleaning up, without notifying users
      // about expected teardown failures after navigation.
      void connection.then(async () => {
        await callInstance?.leave().catch(() => {});
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
  ]);

  const handleLeave = useCallback(() => {
    router.push(isInterviewer ? "/dashboard" : "/appointments");
  }, [isInterviewer, router]);

  if (connectionError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="alert" className="max-w-md text-sm text-danger">{connectionError}</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
        <Button variant="outline" onClick={handleLeave}>Back to appointments</Button>
      </div>
    );
  }

  if (!videoClient || !call) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="text-brand animate-spin" />
        <p className="text-muted-foreground text-sm font-light">Connecting to call…</p>
      </div>
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

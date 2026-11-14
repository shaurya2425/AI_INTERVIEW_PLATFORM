
"use client";

import { useEffect, useCallback, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

// Stream Video
import {
  StreamTheme,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
  CallingState,
  CallControls,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

// Stream Chat
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Window,
  useCreateChatClient,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";

import { Badge } from "@/components/ui/badge";
import { MessageSquare, Sparkles } from "lucide-react";

import {
  LoadingSpinner,
  PageLoader,
} from "@/components/ui/loading-spinner";

import AIQuestionsPanel from "./AIQuestions";

export default function CallUI({
  callId,
  isInterviewer,
  booking,
  onLeave,
  apiKey,
  token,
  currentUser,
}) {
  const { resolvedTheme } = useTheme();

  const { useCallCallingState } = useCallStateHooks();
  const call = useCall();
  const callingState = useCallCallingState();

  const [activeTab, setActiveTab] = useState("chat");

  // CallControls has already attempted to leave before invoking this callback.
  const handleLeave = useCallback((error) => {
    if (error && call?.state.callingState !== CallingState.LEFT) {
      console.error("Stream could not leave the call:", error);
      toast.error(
        "Could not confirm that you left the call. Close the call tab if your camera or microphone remains active."
      );
    }
    onLeave();
  }, [call, onLeave]);

  // Chat client
  const chatClient = useCreateChatClient({
    apiKey,
    tokenOrProvider: token,
    userData: {
      id: currentUser.id,
      name: currentUser.name,
      image: currentUser.imageUrl,
    },
  });

  const [chatChannel, setChatChannel] = useState(null);
  const [chatError, setChatError] = useState(null);

  useEffect(() => {
    if (!chatClient) return;

    let cancelled = false;

    const channel = chatClient.channel(
      "messaging",
      callId,
      {
        name: "Interview Chat",
        members: [
          booking.interviewer.clerkUserId,
          booking.interviewee.clerkUserId,
        ],
      }
    );

    channel
      .watch()
      .then(() => {
        if (cancelled) return;

        setChatChannel(channel);
        setChatError(null);
      })
      .catch(() => {
        if (cancelled) return;

        const message =
          "Unable to connect to interview chat.";

        setChatError(message);

        toast.error(message, {
          id: "chat-connection-error",
        });
      });

    return () => {
      cancelled = true;
      channel.stopWatching().catch(() => {});
    };
  }, [chatClient, callId, booking]);

  if (callingState === CallingState.LEFT) {
    return (
      <PageLoader
        label="Leaving call"
        className="min-h-screen"
      />
    );
  }

  return (
    <div className="flex min-h-[92vh] flex-col overflow-hidden bg-background">

      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-border text-xs text-muted-foreground"
          >
            {booking.interviewer.name}
            <span className="mx-1.5">×</span>
            {booking.interviewee.name}
          </Badge>

          {isInterviewer && (
            <Badge
              variant="outline"
              className="border-amber-400/20 bg-amber-400/5 text-xs text-brand"
            >
              Interviewer
            </Badge>
          )}
        </div>
      </div>

      {/* Call content */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">

        {/* Video */}
        <div className="flex min-w-0 flex-1 flex-col">
          <StreamTheme className="prept-video-theme">
            <SpeakerLayout
              participantBarPosition="bottom"
            />

            <CallControls onLeave={handleLeave} />
          </StreamTheme>
        </div>

        {/* Right sidebar */}
        <div
          className="
            flex w-full shrink-0 flex-col
            border-t border-border bg-background
            h-[640px] min-h-0
            lg:h-[calc(100vh-80px)]
            lg:w-[440px]
            lg:border-l lg:border-t-0
            xl:w-[480px]
          "
        >
          {/* Tabs */}
          <div className="flex shrink-0 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
                activeTab === "chat"
                  ? "border-b-2 border-amber-400 text-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare size={16} />
              Chat
            </button>

            {isInterviewer && (
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
                  activeTab === "ai"
                    ? "border-b-2 border-amber-400 text-brand"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles size={16} />
                AI Buddy
              </button>
            )}
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-hidden">

            {/* Interview chat */}
            <div
              className={`h-full min-h-0 ${
                activeTab === "chat"
                  ? "block"
                  : "hidden"
              }`}
            >
              {chatClient && chatChannel ? (
                <Chat
                  client={chatClient}
                  theme={
                    resolvedTheme === "dark"
                      ? "str-chat__theme-dark"
                      : "str-chat__theme-light"
                  }
                >
                  <Channel channel={chatChannel}>
                    <Window>
                      <MessageList />
                      <MessageInput focus />
                    </Window>
                  </Channel>
                </Chat>
              ) : (
                <div className="flex h-full items-center justify-center p-4">
                  {chatError ? (
                    <p
                      role="alert"
                      className="text-sm text-danger"
                    >
                      {chatError}
                    </p>
                  ) : (
                    <LoadingSpinner
                      label="Connecting to chat"
                    />
                  )}
                </div>
              )}
            </div>

            {/* AI Buddy — interviewer only */}
            {isInterviewer && (
              <div
                className={`h-full min-h-0 overflow-hidden p-4 ${
                  activeTab === "ai"
                    ? "block"
                    : "hidden"
                }`}
              >
                <AIQuestionsPanel
                  callId={callId}
                  sessionId={booking.id}
                  categories={booking.categories || []}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

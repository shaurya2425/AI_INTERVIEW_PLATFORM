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
import { LoadingSpinner, PageLoader } from "@/components/ui/loading-spinner";
import AIQuestionsPanel from "./AIQuestions";

// ─── Call UI (inside StreamCall context) ─────────────────────────────────────

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

  // Auto-stop recording before leaving
  const handleLeave = useCallback(async () => {
    try {
      if (call) {
        const isRecording = call.state?.recording;
        if (isRecording) {
          await call.stopRecording().catch(() => {
            toast.error("Could not stop the recording before leaving the call.");
          });
        }
        await call.leave().catch(() => {
          toast.error("Could not confirm that the call ended. Close the call tab if your camera or microphone remains active.");
        });
      }
    } finally {
      onLeave();
    }
  }, [call, onLeave]);

  // ── Chat client — same token works for both Video + Chat SDKs ──
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

    const channel = chatClient.channel("messaging", callId, {
      name: "Interview Chat",
      members: [
        booking.interviewer.clerkUserId,
        booking.interviewee.clerkUserId,
      ],
    });

    channel
      .watch()
      .then(() => {
        if (cancelled) return;
        setChatChannel(channel);
        setChatError(null);
      })
      .catch(() => {
        if (cancelled) return;
        const message = "Unable to connect to interview chat. Refresh the page to reconnect.";
        setChatError(message);
        toast.error(message, { id: "chat-connection-error" });
      });

    return () => {
      cancelled = true;
      channel.stopWatching().catch(() => {});
    };
  }, [chatClient, callId, booking]);

  if (callingState === CallingState.LEFT) {
    return (
      <PageLoader label="Leaving call" className="min-h-screen" />
    );
  }

  return (
    <div className="min-h-[92vh] bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-border text-muted-foreground text-xs"
          >
            {booking.interviewer.name}
            <span className="text-muted-foreground mx-1.5">×</span>
            {booking.interviewee.name}
          </Badge>
          {isInterviewer && (
            <Badge
              variant="outline"
              className="border-amber-400/20 bg-amber-400/5 text-brand text-xs"
            >
              Interviewer
            </Badge>
          )}
        </div>
      </div>

      {/* Body: video + side panel */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ── LEFT: Video ── */}
        <div className="flex flex-col flex-1 min-w-0">
          <StreamTheme className="prept-video-theme">
            <SpeakerLayout participantBarPosition="bottom" />
            <CallControls onLeave={handleLeave} />
          </StreamTheme>
        </div>

        {/* ── RIGHT: Chat / AI panel ── */}
        <div className="w-full lg:w-85 min-h-96 shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l border-border bg-background">
          {/* Tab switcher */}
          <div className="flex border-b border-border shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                activeTab === "chat"
                  ? "text-brand border-b-2 border-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare size={13} />
              Chat
            </button>

            {/* AI Questions tab — interviewer only */}
            {isInterviewer && (
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                  activeTab === "ai"
                    ? "text-brand border-b-2 border-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles size={13} />
                AI Questions
              </button>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "chat" ? (
              chatClient && chatChannel ? (
                <Chat client={chatClient} theme={resolvedTheme === "dark" ? "str-chat__theme-dark" : "str-chat__theme-light"}>
                  <Channel channel={chatChannel}>
                    <Window>
                      <MessageList />
                      <MessageInput focus />
                    </Window>
                  </Channel>
                </Chat>
              ) : (
                <div className="flex items-center justify-center h-full p-4">
                  {chatError ? <p role="alert" className="text-sm text-danger">{chatError}</p> : <LoadingSpinner label="Connecting to chat" />}
                </div>
              )
            ) : (
              <div className="p-4 h-full overflow-y-scroll max-h-screen">
                <AIQuestionsPanel categories={booking.categories} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

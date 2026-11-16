
"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

// Stream Video
import {
  StreamTheme,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
  CallingState,
  ToggleAudioPublishingButton, ToggleVideoPublishingButton, ScreenShareButton,
  ReactionsButton, RecordCallButton, CancelCallButton, Restricted, OwnCapability,
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
import { Button } from "@/components/ui/button";
import { MessageSquare, Sparkles, GripVertical, Video } from "lucide-react";

import {
  LoadingSpinner,
} from "@/components/ui/loading-spinner";

import EndInterviewButton from "@/components/EndInterviewButton";
import { getInterviewLifecycle } from "@/actions/interviewCompletion";
import AIQuestionsPanel from "./AIQuestions";
import { InterviewQuestionProvider, InterviewQuestionStatus, InterviewChatMessage } from "./InterviewQuestionMessage";

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

  const [activeTab, setActiveTab] = useState(isInterviewer ? "ai" : "chat");
  const [curationTarget, setCurationTarget] = useState(null);

  const splitRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(520);
  const [widthLimit, setWidthLimit] = useState(720);
  const [videoVisible, setVideoVisible] = useState(true);
  const clampWidth = useCallback(width => {
    const available = splitRef.current?.clientWidth || 1200;
    return Math.max(360, Math.min(width, 720, available >= 1024 ? available - 408 : 720));
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { const saved = Number(localStorage.getItem("prept-sidebar-width")); if (saved >= 360) setSidebarWidth(clampWidth(saved)); } catch { /* UI preference is optional. */ }
    });
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width < 1024) return;
      setWidthLimit(Math.min(720, entry.contentRect.width - 408));
      setSidebarWidth(width => clampWidth(width));
    });
    if (splitRef.current) observer.observe(splitRef.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [clampWidth]);
  function saveWidth(width) {
    try { localStorage.setItem("prept-sidebar-width", String(width)); } catch { /* UI preference is optional. */ }
  }
  function resizePanel(event) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const width = clampWidth(splitRef.current.getBoundingClientRect().right - event.clientX);
    setSidebarWidth(width);
  }

  // CallControls has already attempted to leave before invoking this callback.
  const handleLeave = useCallback((error) => {
    if (error && call?.state.callingState !== CallingState.LEFT) {
      console.error("Stream could not leave the call:", error);
      toast.error(
        "Could not confirm that you left the call. Close the call tab if your camera or microphone remains active."
      );
      return;
    }
    onLeave();
  }, [call, onLeave]);

  const [lifecycle, setLifecycle] = useState(null);
  const finishLocally = useCallback(async () => {
    // Database completion is authoritative even while the shared end retries.
    if (call.state.callingState !== CallingState.LEFT) await call.leave().catch(() => {});
    onLeave();
  }, [call, onLeave]);
  useEffect(() => {
    let cancelled = false;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await getInterviewLifecycle(callId);
        if (!cancelled && result.success) {
          setLifecycle(result);
          if (result.status === "COMPLETED") await finishLocally();
        }
      } catch { /* Stream remains the primary disconnect mechanism. */ }
      finally { checking = false; }
    };
    void check();
    const timer = setInterval(check, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [callId, callingState, finishLocally]);

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
    let retryTimer;

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

    const watch = () => channel.watch()
      .then(() => {
        if (cancelled) return;

        setChatChannel(channel);
        setChatError(null);
      })
      .catch(() => {
        if (cancelled) return;

        const message =
          "Unable to connect to interview chat. Retrying automatically...";

        setChatError(message);

        toast.error(message, {
          id: "chat-connection-error",
        });
        retryTimer = setTimeout(watch, 4000);
      });
    void watch();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      channel.stopWatching().catch(() => {});
    };
  }, [chatClient, callId, booking.interviewer.clerkUserId, booking.interviewee.clerkUserId]);

  if (callingState === CallingState.LEFT) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p role="alert">The call disconnected. Checking whether the interview has ended. Your saved interview data is preserved.</p>
        <Button onClick={() => window.location.reload()}>Rejoin meeting</Button>
        <Button variant="outline" onClick={onLeave}>Back to appointments</Button>
      </div>
    );
  }

  return (
    <div className="prept-meeting fixed inset-x-0 bottom-0 top-[72px] z-40 flex min-h-0 flex-col overflow-hidden bg-background text-foreground">

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
        <button type="button" onClick={() => setVideoVisible(value => !value)} aria-expanded={videoVisible} className="workspace-secondary ml-2 shrink-0 lg:hidden"><Video size={16} /><span>{videoVisible ? "Focus workspace" : "Show video"}</span></button>
      </div>

      <InterviewQuestionProvider key={`${currentUser.id}:${callId}`} callId={callId} userId={currentUser.id} isInterviewer={isInterviewer} channel={chatChannel} client={chatClient}>
      {/* Call content */}
      <div ref={splitRef} className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">

        {/* Video */}
        <div className="flex min-h-0 min-w-0 shrink-0 flex-col lg:flex-1">
          <StreamTheme className="prept-video-theme flex min-h-0 flex-1 flex-col">
            <div className={`meeting-video-stage min-h-0 ${videoVisible ? "" : "hidden lg:flex"}`}>
            <SpeakerLayout
              participantBarPosition="bottom"
            />
            </div>

            <div className="str-video__call-controls shrink-0">
              <Restricted requiredGrants={[OwnCapability.SEND_AUDIO]}><ToggleAudioPublishingButton /></Restricted>
              <Restricted requiredGrants={[OwnCapability.SEND_VIDEO]}><ToggleVideoPublishingButton /></Restricted>
              <Restricted requiredGrants={[OwnCapability.CREATE_REACTION]}><ReactionsButton /></Restricted>
              <Restricted requiredGrants={[OwnCapability.SCREENSHARE]}><ScreenShareButton /></Restricted>
              <Restricted requiredGrants={[OwnCapability.START_RECORD_CALL, OwnCapability.STOP_RECORD_CALL]}><RecordCallButton /></Restricted>
              <div className="flex flex-col items-center gap-1"><CancelCallButton caption="Leave Meeting" onLeave={handleLeave} /><span className="text-xs">Leave Meeting</span></div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-3 pb-2 text-center">
              <span className="hidden text-xs text-muted-foreground xl:block">Leave to rejoin later.</span>
              {lifecycle?.status === "COMPLETED" && <p role="status" className="text-sm">Interview completed. Preparing Feedback. {lifecycle.completionState !== "COMPLETE" ? "Finishing the shared call? You may leave safely." : "The shared call has ended."}</p>}
              {isInterviewer && <EndInterviewButton bookingId={booking.id} retry={lifecycle?.status === "COMPLETED"} onCompleted={finishLocally} />}
            </div>
          </StreamTheme>
        </div>

        <div role="separator" aria-label="Resize interview workspace" aria-orientation="vertical" aria-valuemin={360} aria-valuemax={widthLimit} aria-valuenow={Math.round(sidebarWidth)} tabIndex={0}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={resizePanel} onPointerUp={event => { event.currentTarget.releasePointerCapture(event.pointerId); saveWidth(sidebarWidth); }}
          onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const width = clampWidth(event.key === "Home" ? 360 : event.key === "End" ? 720 : sidebarWidth + (event.key === "ArrowLeft" ? 24 : -24)); setSidebarWidth(width); saveWidth(width); }}
          className="group hidden w-2 shrink-0 touch-none cursor-col-resize items-center justify-center border-x border-border bg-surface hover:bg-amber-400/10 focus-visible:bg-amber-400/15 focus-visible:outline-none lg:flex"><GripVertical size={14} className="shrink-0 text-muted-foreground group-hover:text-brand" /></div>
        <aside style={{ "--workspace-width": sidebarWidth + "px" }} className="meeting-workspace flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-border bg-background lg:flex-none lg:border-t-0" aria-label="Interview workspace">
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
          {isInterviewer && <div ref={setCurationTarget} className="flex max-h-[45%] min-h-0 shrink-0 flex-col overflow-hidden border-b border-border p-2" aria-label="Pinned question curation" />}
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
                  <Channel channel={chatChannel} Message={InterviewChatMessage}>
                    <Window>
                      <InterviewQuestionStatus />
                      <MessageList />
                      <MessageInput />
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
                className={`h-full min-h-0 overflow-hidden ${
                  activeTab === "ai"
                    ? "block"
                    : "hidden"
                }`}
              >
                <AIQuestionsPanel
                  key={`${currentUser.id}:${callId}`}
                  callId={callId}
                  sessionId={booking.id}
                  intervieweeName={booking.interviewee.name || "Candidate"}
                  curationTarget={curationTarget}
                  onOpenWorkspace={() => setActiveTab("ai")}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
      </InterviewQuestionProvider>
    </div>
  );
}

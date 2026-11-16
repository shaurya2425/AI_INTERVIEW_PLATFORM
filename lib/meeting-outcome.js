export function getMeetingOutcome(booking, call, transcriptions, now = Date.now()) {
  if (booking.status === "CANCELLED") return {
    state: "cancelled", message: "This meeting was cancelled. No interview feedback is available.",
  };
  if (booking.status === "SCHEDULED" && new Date(booking.endTime).getTime() > now) return { state: "pending", message: "The interview remains active. Leaving temporarily does not generate final feedback." };
  if (booking.status !== "COMPLETED" && call.session?.started_at && !call.session.ended_at && !call.ended_at) return {
    state: "pending", message: "The meeting is still active. Feedback will be available after it ends and the transcript is processed.",
  };
  if (transcriptions.length) return { state: "transcript" };
  if (booking.status !== "COMPLETED" && new Date(booking.endTime).getTime() > now) return {
    state: "pending", message: "This meeting has not finished yet. Please check again after it ends.",
  };
  if (!call.session && !call.current_session_id && !booking.recordingUrl && booking.status !== "COMPLETED") return {
    state: "missed", message: "This meeting did not happen. No call session was started, so there is no interview performance to review.",
  };
  return {
    state: "evidence", message: "Feedback will use saved interview questions, answers and chat because no transcript is available.",
  };
}

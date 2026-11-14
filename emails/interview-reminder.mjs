const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

export function interviewReminderEmail({ booking, recipient, other, role, minutesBefore, from, appUrl, timeZone }) {
  const start = new Date(booking.startTime);
  const dateTime = new Intl.DateTimeFormat("en-IN", {
    timeZone, dateStyle: "full", timeStyle: "short",
  }).format(start);
  const duration = Math.round((new Date(booking.endTime) - start) / 60000);
  const reminder = minutesBefore === 360 ? "6-hour" : "30-minute";
  const link = new URL(booking.streamCallId ? `/call/${encodeURIComponent(booking.streamCallId)}`
    : role === "interviewer" ? "/dashboard" : "/appointments", appUrl).href;
  const subject = `Interview reminder: ${dateTime} (${timeZone})`;
  const greeting = `Hi ${recipient.name || "there"},`;
  const message = `This is your ${reminder} reminder for your Prept interview with ${other.name || "your interview partner"}.`;
  return {
    from, to: recipient.email, subject,
    text: `${greeting}\n\n${message}\n\nWhen: ${dateTime} (${timeZone})\nDuration: ${duration} minutes\nYour role: ${role}\n\nJoin interview: ${link}\n\nPlease check your camera, microphone, and internet connection before joining.\n\nPrept`,
    html: `<html><body style="margin:0;background:#faf8f2;font-family:Arial,sans-serif;color:#292524;padding:24px">
<main style="max-width:560px;margin:auto;background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:32px">
<h1 style="font-size:24px">Prept interview reminder</h1>
<p>${escapeHtml(greeting)}</p><p style="line-height:1.6">${escapeHtml(message)}</p>
<p><strong>When:</strong> ${escapeHtml(dateTime)} (${escapeHtml(timeZone)})</p>
<p><strong>Duration:</strong> ${duration} minutes</p><p><strong>Your role:</strong> ${escapeHtml(role)}</p>
<p style="margin:28px 0"><a href="${escapeHtml(link)}" style="background:#b7791f;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Join interview</a></p>
<p style="font-size:13px;color:#57534e;line-height:1.6">Please check your camera, microphone, and internet connection before joining.</p>
</main></body></html>`,
  };
}

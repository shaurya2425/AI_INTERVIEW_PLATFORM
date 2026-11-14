export const REMINDER_MINUTES = [360, 30];
export const REMINDER_RETRY_WINDOW_MS = 10 * 60 * 1000;
export const REMINDER_TIME_ZONE = "Asia/Kolkata";

function calendarDay(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function dueReminders(booking, now = new Date(), timeZone = REMINDER_TIME_ZONE) {
  if (booking.status !== "SCHEDULED") return [];
  const start = new Date(booking.startTime);
  if (!Number.isFinite(start.getTime()) || start <= now) return [];
  return REMINDER_MINUTES.filter((minutes) => {
    const due = new Date(start.getTime() - minutes * 60000);
    return due <= now && now.getTime() - due.getTime() <= REMINDER_RETRY_WINDOW_MS
      && new Date(booking.createdAt) <= due
      && calendarDay(due, timeZone) === calendarDay(start, timeZone);
  });
}

export function reminderWindows(now) {
  return REMINDER_MINUTES.map((minutes) => ({ startTime: {
    gte: new Date(now.getTime() + minutes * 60000 - REMINDER_RETRY_WINDOW_MS),
    lte: new Date(now.getTime() + minutes * 60000),
  } }));
}

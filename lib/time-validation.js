export function validateTimeWindow(startTime, endTime) {
  if (!startTime || !endTime) return "Choose both a start time and an end time.";
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
    return "Choose valid start and end times.";
  }
  if (endTime <= startTime) {
    return "End time must be after start time on the same day. For example, 6 PM to 10 PM.";
  }
  return null;
}

export function validateDateRange(startTime, endTime) {
  if (!startTime || !endTime) return "Choose both a start time and an end time.";
  if (typeof startTime !== "string" || typeof endTime !== "string") {
    return "Choose valid start and end times.";
  }
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return "Choose valid start and end times.";
  }
  if (end <= start) return "End time must be after start time.";
  return null;
}

export const ERROR_MESSAGES = {
  AI_RATE_LIMITED: "Gemini request limit reached. Please retry after the indicated cooldown.",
  AI_QUOTA_EXHAUSTED: "AI usage quota exhausted. Service will be available after quota reset or capacity increase.",
  AI_MODEL_UNAVAILABLE: "AI model temporarily unavailable. Please retry.",
  AI_CONFIGURATION_ERROR: "AI service configuration issue.",
  TRANSCRIPT_PROCESSING: "Meeting transcript is still being generated.",
  TRANSCRIPT_UNAVAILABLE: "Transcript could not be retrieved.",
  INSUFFICIENT_EVIDENCE: "No usable candidate answers found for evaluation.",
  FEEDBACK_VALIDATION_FAILED: "Generated feedback failed evidence validation.",
  DATABASE_ERROR: "Feedback could not be saved or retrieved.",
  QUESTION_DELIVERY_FAILED: "Question could not be delivered to participants.",
  WEBHOOK_PROCESSING_FAILED: "Transcript synchronization encountered an error.",
};

export function productionFailure(error, fallback = "AI_MODEL_UNAVAILABLE") {
  const status = Number(error?.status || error?.statusCode || error?.StatusCode || error?.response?.status) || undefined;
  let body;
  try { body = JSON.parse(error?.message); } catch { /* SDKs may wrap JSON in prose. */ }
  const details = error?.errorDetails || error?.error?.details || body?.error?.details || [];
  const diagnostic = `${error?.message || ""} ${JSON.stringify(details)}`;
  let code = ERROR_MESSAGES[error?.code] ? error.code : fallback;
  if (!ERROR_MESSAGES[error?.code]) {
    if (status === 503 || status === 404) code = "AI_MODEL_UNAVAILABLE";
    else if ([400, 401, 403].includes(status)) code = "AI_CONFIGURATION_ERROR";
    else if (status === 429 || /RESOURCE_EXHAUSTED/i.test(diagnostic)) {
      // Generic 'quota exceeded' also describes RPM limits; require explicit capacity evidence.
      code = /per.?day|daily|billing|spend.?limit|quota.{0,30}(?:limit\s*:\s*0|exhausted)/i.test(diagnostic)
        ? "AI_QUOTA_EXHAUSTED" : "AI_RATE_LIMITED";
    }
  }
  const retry = details.find?.(item => item.retryDelay)?.retryDelay;
  const seconds = Number.parseFloat(retry || diagnostic.match(/retry in\s+([\d.]+)s/i)?.[1]);
  const retryAfterSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
  return { success: false, code, error: ERROR_MESSAGES[code] + (retryAfterSeconds ? ` Retry in ${retryAfterSeconds} seconds.` : ""), status,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    retryable: !["INSUFFICIENT_EVIDENCE", "AI_CONFIGURATION_ERROR"].includes(code) };
}

export function productionError(code) {
  return Object.assign(new Error(ERROR_MESSAGES[code]), { code, publicMessage: ERROR_MESSAGES[code] });
}

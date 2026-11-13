import { useState } from "react";
import { toast } from "sonner";
import { UNEXPECTED_ACTION_ERROR } from "@/lib/action-result";

const useFetch = (cb) => {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reportError = (message) => {
    const text = typeof message === "string" && message.trim()
      ? message
      : UNEXPECTED_ACTION_ERROR;
    setError(text);
    toast.error(text);
  };

  const fn = async (...args) => {
    setLoading(true);
    setError(null);
    setData(undefined);

    try {
      const response = await cb(...args);
      if (response?.success === false) {
        const message = typeof response.error === "string"
          ? response.error
          : UNEXPECTED_ACTION_ERROR;
        reportError(message);
        return response;
      }
      setData(response);
      setError(null);
      return response;
    } catch {
      // Network failures and redacted server exceptions are not user messages.
      reportError(UNEXPECTED_ACTION_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fn, setData, reportError, clearError: () => setError(null) };
};

export default useFetch;

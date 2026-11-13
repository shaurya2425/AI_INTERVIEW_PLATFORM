import { useState } from "react";
import { toast } from "sonner";
import { UNEXPECTED_ACTION_ERROR } from "@/lib/action-result";

const useFetch = (cb) => {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        setError(message);
        toast.error(message);
        return response;
      }
      setData(response);
      setError(null);
      return response;
    } catch {
      // Network failures and redacted server exceptions are not user messages.
      setError(UNEXPECTED_ACTION_ERROR);
      toast.error(UNEXPECTED_ACTION_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fn, setData, clearError: () => setError(null) };
};

export default useFetch;

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAIBuddyHistory, importAIBuddyHistory } from "@/actions/aiBuddyHistory";
import { makeDefaultPreferences } from "@/lib/interviewCatalog";

export default function useBuddyHistory(callId, sessionId, userId) {
  const legacyKey = `prept-ai-buddy:${sessionId || callId}`;
  const storageKey = `prept-ai-buddy:${userId}:${sessionId || callId}`;
  const [messages, setMessages] = useState([]);
  const [preferences, setPreferences] = useState(makeDefaultPreferences);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const backupWritable = useRef(true);
  const current = useRef([]);
  const session = useRef(0);
  const syncingRef = useRef(false);

  const syncHistory = useCallback(async (local = current.current, version = session.current) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const remote = await getAIBuddyHistory(callId);
      if (!remote.success) throw new Error(remote.error);
      const ids = new Set(remote.messages.map(m => m.id));
      // One record per request keeps even long legacy coding responses below action limits.
      for (const message of local.filter(m => !ids.has(m.id))) {
        if (version !== session.current) return;
        const result = await importAIBuddyHistory(callId, [message]);
        if (!result.success) throw new Error(result.error);
      }
      const result = await getAIBuddyHistory(callId);
      if (!result.success) throw new Error(result.error);
      if (version !== session.current) return;
      setMessages(previous => {
        const savedIds = new Set(result.messages.map(m => m.id));
        return [...result.messages, ...previous.filter(m => !savedIds.has(m.id))];
      });
      setHistoryError("");
    } catch (error) {
      if (version === session.current) setHistoryError(error.message || "History sync failed. Your local copy is preserved; retry sync.");
    } finally {
      syncingRef.current = false;
      if (version === session.current) setSyncing(false);
    }
  }, [callId]);

  useEffect(() => {
    const version = ++session.current;
    // The scheduled start avoids duplicate imports during React's initial effect replay.
    const timer = setTimeout(() => {
      let saved = null;
      let legacy = null;
      try {
        legacy = JSON.parse(localStorage.getItem(legacyKey) || "null");
        saved = JSON.parse(localStorage.getItem(storageKey) || "null") || legacy;
      }
      catch {
        backupWritable.current = false;
        setStorageWarning("Browser history could not be read. Its original copy is untouched; server history will be restored. Keep this page open until new messages finish saving.");
      }
      const localMap = new Map();
      for (const message of [...(Array.isArray(legacy?.messages) ? legacy.messages : []), ...(Array.isArray(saved?.messages) ? saved.messages : [])]) {
        if (message && typeof message.id === "string") localMap.set(message.id, message);
      }
      const local = [...localMap.values()];
      current.current = local;
      setMessages(local);
      setPreferences({ ...makeDefaultPreferences(), ...saved?.preferences, mode: "FREE_FLOW" });
      setActiveQuestionId(saved?.activeQuestionId || null);
      setInput(typeof saved?.input === "string" ? saved.input : "");
      setReady(true);
      void syncHistory(local, version);
    }, 0);
    return () => { clearTimeout(timer); ++session.current; };
  }, [storageKey, legacyKey, syncHistory]);

  useEffect(() => {
    current.current = messages;
    if (!ready || !backupWritable.current) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ messages, preferences, activeQuestionId, input })); }
    catch { setStorageWarning("Browser backup is unavailable. Saved server history is safe, but keep this page open until new messages finish saving."); }
  }, [ready, storageKey, messages, preferences, activeQuestionId, input]);

  return { messages, setMessages, preferences, setPreferences, activeQuestionId, setActiveQuestionId, setHistoryError,
    input, setInput, ready, syncing, historyError, storageWarning, syncHistory };
}

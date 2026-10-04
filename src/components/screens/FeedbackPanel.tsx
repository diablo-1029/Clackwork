"use client";

import { useState } from "react";
import { audio } from "@/audio/audioManager";
import { Button } from "@/components/ui/Button";
import { Panel, Ribbon } from "@/components/ui/Chunky";
import { APP_VERSION } from "@/lib/appPath";
import { FEEDBACK_MAX_LENGTH, isOnlineBoardConfigured, sendFeedback } from "@/lib/onlineBoard";
import { usePlayerStore } from "@/stores/playerStore";

type Status = "idle" | "sending" | "sent" | "failed";

/** A short note to the people who make the game. Shown in Settings when the online service is set up. */
export function FeedbackPanel() {
  const level = usePlayerStore((s) => s.factoryLevel);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  if (!isOnlineBoardConfigured()) return null;

  const send = async () => {
    const text = message.trim();
    if (!text || status === "sending") return;
    setStatus("sending");
    const ok = await sendFeedback({ message: text, version: APP_VERSION, level });
    audio.play(ok ? "purchase" : "deny");
    setStatus(ok ? "sent" : "failed");
    if (ok) setMessage("");
  };

  return (
    <Panel className="mt-4 p-4">
      <Ribbon tone="deep">Feedback</Ribbon>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="feedback-message" className="text-sm font-bold text-muted">
          What do you like, what is annoying, what is missing? Anything helps.
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (status !== "idle" && status !== "sending") setStatus("idle");
          }}
          maxLength={FEEDBACK_MAX_LENGTH}
          rows={4}
          placeholder="Type your thoughts here"
          className="sf-inset min-h-24 w-full resize-y rounded-2xl border-2 border-line p-3 font-bold outline-none focus:border-brand"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-muted tabular-nums">
            {message.length} / {FEEDBACK_MAX_LENGTH}
          </span>
          <Button type="submit" silent variant="secondary" disabled={!message.trim() || status === "sending"}>
            {status === "sending" ? "Sending…" : "Send"}
          </Button>
        </div>
        <p className="text-xs font-bold text-muted" role="status">
          {status === "sent"
            ? "Thank you. Your feedback was sent."
            : status === "failed"
              ? "That did not send. Check your connection, or wait a minute and try again."
              : "Sent with the game version, your Factory Level and a random id for this device. No name or contact details."}
        </p>
      </form>
    </Panel>
  );
}

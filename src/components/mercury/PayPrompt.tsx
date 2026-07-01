"use client";

import { useEffect, useState } from "react";

const KEY = "mercury_pay_prompt_done";

/**
 * Lightweight "would you pay / how much" prompt — the core validation question.
 * Shows only after the employer has done real work (enough applicants) and only
 * once (persisted in localStorage). Answers POST to /api/mercury/feedback.
 */
export function PayPrompt({ applicantCount }: { applicantCount: number }) {
  const [show, setShow] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<null | "thanks">(null);

  // Reveal is gated on localStorage (a client-only store), so the read is
  // deferred to an effect on purpose — reading it during render would diverge
  // from the SSR output and cause a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (applicantCount >= 3 && !localStorage.getItem(KEY)) setShow(true);
  }, [applicantCount]);

  if (!show) return null;

  function finish() {
    localStorage.setItem(KEY, "1");
    setTimeout(() => setShow(false), 1100);
  }

  async function answer(wouldPay: boolean) {
    setDone("thanks");
    await fetch("/api/mercury/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        would_pay: wouldPay,
        amount_hkd: amount ? Number(amount) : null,
        comment: comment || null,
      }),
    }).catch(() => {});
    finish();
  }

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setShow(false);
  }

  return (
    <div className="panel rise mb-4 flex flex-col gap-3 p-4" style={{ boxShadow: "var(--shadow-panel)" }}>
      {done === "thanks" ? (
        <p className="text-sm text-text-2">Thank you — that&apos;s exactly the signal we needed.</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text">Is Mercury worth paying for?</h3>
              <p className="mt-1 text-xs text-muted">
                You&apos;ve worked a real role here. Honestly — would you pay for this, and how much
                per month?
              </p>
            </div>
            <button onClick={dismiss} className="text-dim hover:text-text-2" aria-label="Dismiss">
              ✕
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded border border-border bg-bg px-2.5 py-1.5">
              <span className="text-xs text-dim">HKD</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="0"
                className="tnum w-16 bg-transparent text-sm text-text outline-none"
              />
              <span className="text-xs text-dim">/mo</span>
            </div>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything you'd want first? (optional)"
              maxLength={2000}
              className="min-w-[12rem] flex-1 rounded border border-border bg-bg px-3 py-1.5 text-sm text-text-2 outline-none focus:border-signal"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => answer(true)}
              className="mercury-btn px-4 py-2 text-xs tracking-wider"
            >
              YES, I&apos;D PAY
            </button>
            <button
              onClick={() => answer(false)}
              className="rounded border border-border px-4 py-2 text-xs text-text-2 hover:border-border-strong"
            >
              Not yet
            </button>
          </div>
        </>
      )}
    </div>
  );
}

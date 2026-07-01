"use client";

import { useEffect } from "react";

export default function MercuryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 py-24 text-center">
      <h1 className="text-base font-semibold text-text">Something went wrong</h1>
      <p className="text-sm text-muted">
        We hit a snag loading this view. Your data is safe — nothing was lost.
      </p>
      <button onClick={reset} className="mercury-btn px-5 py-2.5 text-xs tracking-wider">
        TRY AGAIN
      </button>
    </main>
  );
}

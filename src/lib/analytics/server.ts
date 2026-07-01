// Server-side event capture: always emits a structured log line, and also
// forwards to PostHog's HTTP capture endpoint when NEXT_PUBLIC_POSTHOG_KEY is
// set (no posthog-node dependency needed — capture is a plain POST).
export function captureServerEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
) {
  console.log(JSON.stringify({ event, distinct_id: distinctId, ...properties }));

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

  fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event,
      distinct_id: distinctId,
      properties: { ...properties },
    }),
  }).catch((err) => console.error(`captureServerEvent(${event}) failed:`, err));
}

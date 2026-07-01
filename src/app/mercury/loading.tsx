export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 h-7 w-32 animate-pulse rounded bg-surface-2" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel h-28 animate-pulse" />
        ))}
      </div>
    </main>
  );
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-xl font-bold">No connection</h1>
      <p className="text-sm text-muted">
        Check your network. RallyUp will reconnect automatically when you&apos;re back online.
      </p>
    </main>
  );
}

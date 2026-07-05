import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg-deep px-6 py-12">
      <Link href="/" className="mb-10 select-none">
        <span className="font-mono text-sm font-semibold tracking-[0.55em] text-mercury">MERCURY</span>
      </Link>
      <div className="panel w-full max-w-sm p-7">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs leading-relaxed text-dim">
        A calm hiring workspace. Every applicant stays visible; every filter is yours.
      </p>
    </main>
  );
}

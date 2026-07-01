import Link from "next/link";

export default function RoleNotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 py-24 text-center">
      <h1 className="text-base font-semibold text-text">Role not found</h1>
      <p className="text-sm text-muted">
        This role doesn&apos;t exist, or it isn&apos;t part of your workspace.
      </p>
      <Link href="/mercury" className="mercury-btn px-5 py-2.5 text-xs tracking-wider">
        BACK TO ROLES
      </Link>
    </main>
  );
}

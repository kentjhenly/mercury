"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth/auth-client";
import { track, identify } from "@/lib/analytics/client";
import { FUNNEL } from "@/lib/analytics/events";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await signUp.email({
          email,
          password,
          name,
          display_name: name,
        } as Parameters<typeof signUp.email>[0]);
        if (error) {
          const msg =
            error.message ||
            (error as { error?: { message?: string } }).error?.message ||
            error.statusText ||
            (error.status ? `HTTP ${error.status}` : null) ||
            "Could not create account";
          console.error("[sign-up]", error.status, msg, error);
          throw new Error(msg);
        }
        if (data?.user?.id) {
          identify(data.user.id, { email });
          track(FUNNEL.SIGNED_UP, { email });
        }
      } else {
        const { data, error } = await signIn.email({ email, password });
        if (error) throw new Error(error.message || "Could not sign in");
        if (data?.user?.id) identify(data.user.id, { email });
      }
      router.push("/mercury");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">
          {isSignUp ? "Create your workspace" : "Sign in"}
        </h1>
        <p className="mt-1 text-xs text-muted">
          {isSignUp ? "One employer, one board, your applicants." : "Welcome back."}
        </p>
      </div>

      {isSignUp && (
        <Field
          label="Your name / company"
          value={name}
          onChange={setName}
          autoComplete="name"
          required
        />
      )}
      <Field
        label="Work email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete={isSignUp ? "new-password" : "current-password"}
        required
        minLength={8}
        hint={isSignUp ? "At least 8 characters." : undefined}
      />

      {error && (
        <p role="alert" className="rounded tone-negative px-3 py-2 text-xs">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mercury-btn mt-1 px-4 py-2.5 text-xs tracking-wider disabled:opacity-60 [&::after]:hidden"
      >
        {loading ? "WORKING…" : isSignUp ? "CREATE ACCOUNT" : "SIGN IN"}
      </button>

      <p className="text-center text-xs text-dim">
        {isSignUp ? (
          <>
            Already have a workspace?{" "}
            <Link href="/sign-in" className="text-signal hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/sign-up" className="text-signal hover:underline">
              Create a workspace
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-signal"
        {...rest}
      />
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </label>
  );
}

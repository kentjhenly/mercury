"use client";

import { createAuthClient } from "better-auth/react";

// No baseURL: same-origin. Never hardcode localhost here — a missing
// NEXT_PUBLIC_* at build time would bake it into the production bundle.
export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession } = authClient;

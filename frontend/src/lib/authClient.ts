import { createAuthClient } from "better-auth/react";

// In production use the current origin so cookies are always first-party.
const baseURL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : window.location.origin);

export const authClient = createAuthClient({ baseURL });

export const { signIn, signUp, signOut, useSession } = authClient;

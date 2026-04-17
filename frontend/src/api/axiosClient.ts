import axios from "axios";

// In production the Vercel proxy forwards /api/* to the backend.
// Using a relative base means requests always go to the same origin (no CORS).
const baseURL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : "");

export const apiClient = axios.create({
    baseURL,
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
});

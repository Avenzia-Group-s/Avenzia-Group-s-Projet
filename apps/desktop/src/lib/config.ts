export const API_URL: string = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
export const inTauri = "__TAURI_INTERNALS__" in window;

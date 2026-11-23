export const API_URL: string = (
  import.meta.env.VITE_API_URL ||
  "https://integral-proceed-priced-acknowledge.trycloudflare.com"
).replace(/\/$/, "");

export const inTauri = "__TAURI_INTERNALS__" in window;
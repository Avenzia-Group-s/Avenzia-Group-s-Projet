import { useEffect } from "react";
import { useApp } from "./store";

const hexToRgb = (h: string) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`; };

export function useThemeEffect() {
  const { theme, accent, reduceMotion } = useApp();
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.dataset.theme = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
    apply();
    if (theme === "system") { mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply); }
  }, [theme]);
  useEffect(() => { document.documentElement.style.setProperty("--accent", hexToRgb(accent)); }, [accent]);
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", reduceMotion); }, [reduceMotion]);
}

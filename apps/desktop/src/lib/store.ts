import { create } from "zustand";
import type { PublicProject, PublicUser } from "@avenzia/shared";

export type ThemeMode = "dark" | "light" | "system";
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } };

interface State {
  token: string | null; user: PublicUser | null; projects: PublicProject[];
  theme: ThemeMode; accent: string; reduceMotion: boolean; menuCollapsed: boolean;
  currentSpace: string; currentModule: string;
  set: (p: Partial<State>) => void;
  setPref: <K extends "theme" | "accent" | "reduceMotion" | "menuCollapsed">(k: K, v: State[K]) => void;
}

export const useApp = create<State>((set) => ({
  token: null, user: null, projects: [],
  theme: load("pref.theme", "dark"), accent: load("pref.accent", "#5865F2"),
  reduceMotion: load("pref.reduceMotion", false), menuCollapsed: load("pref.menuCollapsed", false),
  currentSpace: "home", currentModule: "dashboard",
  set: (p) => set(p),
  setPref: (k, v) => { save(`pref.${k}`, v); set({ [k]: v } as Partial<State>); },
}));

import { createContext, useContext, type ReactNode } from "react";
import { useUpdater } from "./useUpdater";

const Ctx = createContext<ReturnType<typeof useUpdater> | null>(null);
export function UpdaterProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={useUpdater()}>{children}</Ctx.Provider>;
}
export function useUpdaterCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("UpdaterProvider manquant");
  return v;
}

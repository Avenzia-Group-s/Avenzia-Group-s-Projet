import { useEffect, useState } from "react";
import { restoreSession } from "./lib/auth";
import { useApp } from "./lib/store";
import { useThemeEffect } from "./lib/theme";
import { LoginModal } from "./components/LoginModal";
import { Shell } from "./components/Shell";
import { Logo } from "./components/Logo";
import { UpdaterProvider } from "./hooks/UpdaterProvider";

export default function App() {
  useThemeEffect();
  const user = useApp((s) => s.user);
  const [booting, setBooting] = useState(true);
  useEffect(() => { restoreSession().finally(() => setBooting(false)); }, []);

  if (user) return <UpdaterProvider><Shell /></UpdaterProvider>;
  return (
    <div className="h-full grid place-items-center bg-bg relative">
      <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(60% 50% at 50% 30%, rgb(var(--accent) / .25), transparent)" }} />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <Logo size={64} />
        <h1 className="text-2xl font-bold tracking-tight">Avenzia | Groups</h1>
      </div>
      {booting ? <div className="absolute bottom-16 h-1 w-40 overflow-hidden rounded bg-surface"><div className="h-full w-1/2 animate-pulse rounded bg-accent" /></div> : <LoginModal />}
    </div>
  );
}

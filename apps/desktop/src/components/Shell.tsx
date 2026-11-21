import { useEffect, useMemo } from "react";
import {
  Bell, CalendarDays, CheckSquare, ClipboardList, FileText, FolderKanban, Lightbulb, Megaphone, MessageSquare,
  PanelLeftClose, PanelLeftOpen, ScrollText, Settings, Shield, Users, Hash, LayoutDashboard, Activity, type LucideIcon,
} from "lucide-react";
import { isAdminRole } from "@avenzia/shared";
import { useApp } from "../lib/store";
import { Logo } from "./Logo";
import { Dashboard } from "./Dashboard";
import { SettingsPage } from "./SettingsPage";
import { UpdateBanner } from "./UpdateBanner";

interface Mod { id: string; label: string; icon: LucideIcon; admin?: boolean }
interface Section { title: string; mods: Mod[]; admin?: boolean }

const SECTIONS: Section[] = [
  { title: "Accueil", mods: [{ id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard }, { id: "activity", label: "Activités récentes", icon: Activity }, { id: "notifications", label: "Notifications", icon: Bell }] },
  { title: "Gestion", mods: [{ id: "tasks", label: "Tâches", icon: CheckSquare }, { id: "notes", label: "Bloc-notes", icon: FileText }, { id: "spec", label: "Cahier des charges", icon: ClipboardList }, { id: "calendar", label: "Calendrier", icon: CalendarDays }, { id: "agenda", label: "Agenda", icon: FolderKanban }, { id: "ideas", label: "Idées", icon: Lightbulb }] },
  { title: "Communication", mods: [{ id: "announcements", label: "Annonces", icon: Megaphone }, { id: "channels", label: "Salons", icon: Hash }, { id: "dms", label: "Messages privés", icon: MessageSquare }] },
  { title: "Administration", admin: true, mods: [{ id: "members", label: "Membres", icon: Users }, { id: "roles", label: "Rôles", icon: Shield }, { id: "audit", label: "Journal d'audit", icon: ScrollText }] },
];

export function Shell() {
  const { user, projects, currentSpace, currentModule, menuCollapsed, set, setPref } = useApp();
  const space = currentSpace === "home" ? null : projects.find((p) => p.id === currentSpace) ?? null;
  const isAdmin = !!user && isAdminRole(user.globalRole);

  // Si le projet courant n'est plus accessible (rôle Discord retiré), retour à l'accueil.
  useEffect(() => { if (currentSpace !== "home" && currentSpace !== "settings" && !space) set({ currentSpace: "home", currentModule: "dashboard" }); }, [space, currentSpace, set]);

  const sections = useMemo(() => SECTIONS.filter((s) => !s.admin || isAdmin), [isAdmin]);

  return (
    <div className="flex h-full">
      <nav aria-label="Espaces" className="flex w-[72px] flex-col items-center gap-2 bg-side py-3">
        <button onClick={() => set({ currentSpace: "home", currentModule: "dashboard" })} aria-label="Accueil global" className="rounded-2xl"><Logo size={48} /></button>
        <div className="my-1 h-px w-8 bg-line" />
        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
          {projects.map((p) => (
            <button key={p.id} title={p.name} aria-label={p.name} onClick={() => set({ currentSpace: p.id, currentModule: "dashboard" })}
              className={`relative grid h-12 w-12 place-items-center text-lg font-bold text-white transition-all ${currentSpace === p.id ? "rounded-2xl" : "rounded-[24px] hover:rounded-2xl"}`} style={{ background: p.color }}>
              {currentSpace === p.id && <span className="absolute -left-3 h-8 w-1 rounded-r bg-txt" />}
              {p.name.slice(0, 1).toUpperCase()}
            </button>
          ))}
        </div>
        <button onClick={() => set({ currentSpace: "settings" })} aria-label="Paramètres" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-txt"><Settings size={20} /></button>
        {user?.avatarUrl ? <img src={user.avatarUrl} alt={user.username} className="h-10 w-10 rounded-full" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-accent font-bold text-white">{user?.username.slice(0, 1)}</div>}
      </nav>

      <aside aria-label="Menu" className={`overflow-hidden bg-surface transition-[width] duration-200 ${menuCollapsed ? "w-14" : "w-60"}`}>
        <div className="flex h-12 items-center justify-between border-b border-line px-3">
          {!menuCollapsed && <span className="truncate font-semibold">{space?.name ?? "Avenzia"}</span>}
          <button onClick={() => setPref("menuCollapsed", !menuCollapsed)} aria-label={menuCollapsed ? "Agrandir le menu" : "Réduire le menu"} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-txt">
            {menuCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <div className="space-y-3 p-2">
          {sections.map((s) => (
            <div key={s.title}>
              {!menuCollapsed && <p className="px-2 pb-1 text-xs font-semibold text-muted">{s.title}</p>}
              {s.mods.map((m) => (
                <button key={m.id} title={m.label} onClick={() => set({ currentModule: m.id })}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${currentModule === m.id && currentSpace !== "settings" ? "bg-accent/15 text-txt" : "text-muted hover:bg-surface2 hover:text-txt"} ${menuCollapsed ? "justify-center" : ""}`}>
                  <m.icon size={18} />{!menuCollapsed && m.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-bg">
        <UpdateBanner />
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {currentSpace === "settings" ? <SettingsPage /> : currentModule === "dashboard" ? <Dashboard /> : (
            <div className="grid h-full place-items-center text-center">
              <div><p className="text-lg font-semibold">Ce module arrive dans une prochaine phase</p><p className="mt-1 text-sm text-muted">Il n'est pas encore implémenté.</p></div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

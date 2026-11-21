import { useApp } from "../lib/store";

export function Dashboard() {
  const { user, projects, currentSpace, set } = useApp();
  const project = projects.find((p) => p.id === currentSpace);

  if (project) return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl text-2xl font-bold text-white" style={{ background: project.color }}>{project.name[0]}</div>
        <div><h1 className="text-2xl font-bold">{project.name}</h1><p className="text-sm text-muted">{project.description || "Aucune description."}</p></div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5"><p className="text-sm text-muted">Statut</p><p className="mt-1 font-semibold">{project.status}</p></div>
        <div className="rounded-2xl border border-line bg-surface p-5"><p className="text-sm text-muted">Votre rôle dans le projet</p><p className="mt-1 font-semibold">{project.myRole}</p></div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-4">
        {user?.avatarUrl && <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-full" />}
        <div><h1 className="text-2xl font-bold">Bonjour, {user?.username}</h1><p className="text-sm text-muted">Voici vos espaces de travail.</p></div>
      </div>
      <h2 className="mt-8 mb-3 font-semibold">Projets accessibles</h2>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Aucun projet pour le moment. L'accès est accordé par les rôles Discord « Projet | … ».</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <button key={p.id} onClick={() => set({ currentSpace: p.id, currentModule: "dashboard" })} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-accent">
              <span className="grid h-11 w-11 place-items-center rounded-xl font-bold text-white" style={{ background: p.color }}>{p.name[0]}</span>
              <span><span className="block font-semibold">{p.name}</span><span className="text-xs text-muted">{p.status}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

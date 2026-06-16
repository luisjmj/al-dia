import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  CheckSquare,
  BarChart3,
  Moon,
  Sun,
  CheckCircle2,
  LogOut,
  Copy,
  Check,
  UserPlus,
  Settings,
  Power,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useStore } from "../store";

const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true },
  { to: "/deudas", label: "Deudas", icon: Wallet, end: false },
  { to: "/pagos", label: "Pagos", icon: CheckSquare, end: false },
  { to: "/stats", label: "Stats", icon: BarChart3, end: false },
];

// Cierra la app. En la PWA instalada (standalone) window.close() funciona;
// en una pestaña normal el navegador lo bloquea, así que avisamos.
function closeApp() {
  if (!confirm("¿Cerrar Al Día?")) return;
  window.close();
  // Si seguimos aquí, el navegador no permitió cerrar (pestaña normal).
  setTimeout(() => {
    if (!document.hidden) {
      alert("Para cerrar, instala la app o cierra la pestaña manualmente.");
    }
  }, 300);
}

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme, loading } = useStore();

  return (
    <div className="min-h-full flex bg-bg">
      {/* Sidebar (PC) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 gap-2">
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-brand grid place-items-center">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-text leading-none">Al Día</div>
            <div className="text-xs text-muted">control de deudas</div>
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
                isActive
                  ? "bg-brand-soft text-brand"
                  : "text-muted hover:bg-surface-2 hover:text-text"
              }`
            }
          >
            <n.icon className="w-5 h-5" />
            {n.label}
          </NavLink>
        ))}
        <div className="mt-auto" />
        <AccountPanel />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-8 h-16 border-b border-border bg-bg/80 backdrop-blur pt-[env(safe-area-inset-top)] box-content">
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-8 h-8 rounded-lg bg-brand grid place-items-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold">Al Día</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `btn-ghost !px-2.5 !py-2.5 ${isActive ? "text-brand" : ""}`
              }
              aria-label="Administración"
              title="Administración"
            >
              <Settings className="w-5 h-5" />
            </NavLink>
            <button
              onClick={toggleTheme}
              className="btn-ghost !px-2.5 !py-2.5"
              aria-label="Cambiar tema"
              title="Cambiar tema"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={closeApp}
              className="btn-ghost !px-2.5 !py-2.5 hover:text-red-400"
              aria-label="Cerrar app"
              title="Cerrar app"
            >
              <Power className="w-5 h-5" />
            </button>
            <div className="md:hidden">
              <MobileMenu />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 pb-28 md:pb-10 max-w-5xl w-full mx-auto">
          {loading ? <LoadingBlock /> : children}
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-border grid grid-cols-4 px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition ${
                isActive ? "text-brand" : "text-muted"
              }`
            }
          >
            <n.icon className="w-5 h-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="grid place-items-center py-24 text-muted text-sm animate-pulse">
      Cargando tus datos…
    </div>
  );
}

function AccountPanel() {
  const { backend, users, currentUser, currentUserId, setCurrentUser, household, signOut } =
    useStore();

  if (backend === "local") {
    return (
      <div className="card p-2">
        <div className="text-xs text-muted px-1.5 pb-1.5">Viendo como (demo)</div>
        <div className="flex flex-col gap-1">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setCurrentUser(u.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                u.id === currentUserId
                  ? "bg-surface-2 text-text font-semibold"
                  : "text-muted hover:bg-surface-2"
              }`}
            >
              <Avatar user={u} />
              {u.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <InvitePanel />
      <div className="card p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar user={currentUser} />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{currentUser.name}</div>
            <div className="text-xs text-muted truncate">{household?.name}</div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="p-2 rounded-lg text-muted hover:bg-surface-2 hover:text-text shrink-0"
          title="Cerrar sesión"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}

function InvitePanel() {
  const { household, users, joinHousehold } = useStore();
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function copy() {
    if (!household) return;
    await navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function join() {
    setErr(null);
    try {
      await joinHousehold?.(code);
      setJoining(false);
      setCode("");
    } catch (e: any) {
      setErr("Código inválido");
    }
  }

  return (
    <div className="card p-3">
      <div className="text-xs text-muted mb-2 flex items-center gap-1.5">
        <UserPlus className="w-3.5 h-3.5" /> Hogar compartido
      </div>
      {/* miembros */}
      <div className="flex -space-x-2 mb-2">
        {users.map((u) => (
          <span
            key={u.id}
            className="w-7 h-7 rounded-full grid place-items-center text-white text-xs font-bold border-2 border-surface"
            style={{ backgroundColor: u.color }}
            title={u.name}
          >
            {u.name.charAt(0)}
          </span>
        ))}
      </div>
      {/* código para invitar */}
      <button
        onClick={copy}
        className="w-full flex items-center justify-between bg-surface-2 rounded-lg px-2.5 py-2 text-sm hover:bg-border transition"
      >
        <span className="font-mono font-semibold tracking-wider">
          {household?.inviteCode ?? "—"}
        </span>
        {copied ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Copy className="w-4 h-4 text-muted" />
        )}
      </button>
      <div className="text-[11px] text-muted mt-1 px-0.5">
        Comparte este código con tu pareja para que se una.
      </div>

      {/* unirse a otro hogar */}
      {!joining ? (
        <button
          onClick={() => setJoining(true)}
          className="text-xs text-brand font-medium mt-2"
        >
          Tengo un código →
        </button>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          <input
            className="input !py-1.5 !text-sm"
            placeholder="código"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {err && <div className="text-[11px] text-red-400">{err}</div>}
          <div className="flex gap-1.5">
            <button className="btn-ghost flex-1 !py-1.5 !text-sm" onClick={() => setJoining(false)}>
              Cancelar
            </button>
            <button className="btn-primary flex-1 !py-1.5 !text-sm" onClick={join}>
              Unirme
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Menú de cuenta en móvil: abre un panel desde arriba
function MobileMenu() {
  const { currentUser } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>
        <Avatar user={currentUser} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-end p-4"
          onClick={() => setOpen(false)}
        >
          <div className="w-72 mt-12" onClick={(e) => e.stopPropagation()}>
            <AccountPanel />
          </div>
        </div>
      )}
    </>
  );
}

function Avatar({ user }: { user: { name: string; color: string } }) {
  return (
    <span
      className="w-7 h-7 rounded-full grid place-items-center text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: user.color }}
    >
      {user.name.charAt(0)}
    </span>
  );
}

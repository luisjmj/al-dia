import { useEffect, useState } from "react";
import { useStore } from "../store";
import { Bell, BellOff, BellRing } from "lucide-react";
import {
  pushSupported,
  permission,
  isSubscribed,
  subscribe,
  unsubscribe,
} from "../lib/push";

// Tarjeta para activar/desactivar los avisos de vencimiento en este dispositivo.
export default function NotificationSettings() {
  const { currentUserId, household } = useStore();
  const supported = pushSupported();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supported) isSubscribed().then(setOn);
  }, [supported]);

  if (!supported) {
    return (
      <Shell>
        <p className="text-sm text-muted">
          Este navegador no soporta notificaciones push. En iPhone, primero
          instala la app en la pantalla de inicio (Compartir → “Agregar a inicio”).
        </p>
      </Shell>
    );
  }

  const denied = permission() === "denied";

  async function toggle() {
    setError(null);
    setBusy(true);
    try {
      if (on) {
        await unsubscribe();
        setOn(false);
      } else {
        if (!currentUserId || !household) return;
        const ok = await subscribe(currentUserId, household.id);
        setOn(ok);
        if (!ok) setError("No se concedió el permiso de notificaciones.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error activando notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="flex items-center gap-3">
        <span
          className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
            on ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted"
          }`}
        >
          {on ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            Avisos de vencimiento {on ? "activos" : "desactivados"}
          </div>
          <div className="text-xs text-muted">
            Te avisamos 7 días antes y 24 horas antes. Si ya pagaste, no llega.
          </div>
        </div>
        <button
          className={on ? "btn-ghost !py-2 shrink-0" : "btn-primary !py-2 shrink-0"}
          onClick={toggle}
          disabled={busy || denied}
        >
          {on ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {on ? "Desactivar" : "Activar"}
        </button>
      </div>

      {denied && !on && (
        <p className="text-xs text-amber-400 mt-3">
          Bloqueaste las notificaciones en este navegador. Actívalas desde los
          ajustes del sitio para poder recibir avisos.
        </p>
      )}
      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Notificaciones</h2>
      <div className="card p-4">{children}</div>
    </div>
  );
}

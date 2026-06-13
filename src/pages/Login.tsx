import { useState } from "react";
import { useAuth } from "../auth";
import { CheckCircle2 } from "lucide-react";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "in") await signIn(email.trim(), password);
      else await signUp(name.trim(), email.trim(), password);
    } catch (err: any) {
      setError(traducir(err?.message ?? "Error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center px-4 py-10 bg-bg">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand grid place-items-center mb-3">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">Al Día</h1>
          <p className="text-muted text-sm">Control de deudas</p>
        </div>

        <div className="card p-5">
          <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2 rounded-xl mb-5">
            <button
              onClick={() => setMode("in")}
              className={`py-2 rounded-lg text-sm font-semibold transition ${
                mode === "in" ? "bg-surface text-text shadow" : "text-muted"
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode("up")}
              className={`py-2 rounded-lg text-sm font-semibold transition ${
                mode === "up" ? "bg-surface text-text shadow" : "text-muted"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === "up" && (
              <div>
                <label className="label">Nombre</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button className="btn-primary w-full mt-1" disabled={busy}>
              {busy ? "..." : mode === "in" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-5">
          Tus datos se guardan de forma segura en tu cuenta.
        </p>
      </div>
    </div>
  );
}

function traducir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email o contraseña incorrectos.";
  if (m.includes("already registered")) return "Ese email ya tiene cuenta.";
  if (m.includes("password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("email")) return "Revisa el email.";
  return msg;
}

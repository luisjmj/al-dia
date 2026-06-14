import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StoreProvider, loadTheme } from "./store";
import { SupabaseStoreProvider } from "./storeSupabase";
import { AuthProvider, useAuth, hasSupabase } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Debts from "./pages/Debts";
import Payments from "./pages/Payments";
import Stats from "./pages/Stats";
import Admin from "./pages/Admin";
import { CheckCircle2 } from "lucide-react";

// aplica el tema guardado al cargar
loadTheme();
document.documentElement.classList.toggle("dark", loadTheme() === "dark");

function AppRoutes() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/deudas" element={<Debts />} />
          <Route path="/pagos" element={<Payments />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function Splash() {
  return (
    <div className="min-h-full grid place-items-center bg-bg">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <div className="w-14 h-14 rounded-2xl bg-brand grid place-items-center">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <span className="text-muted text-sm">Cargando Al Día…</span>
      </div>
    </div>
  );
}

// Modo nube: requiere sesión
function CloudApp() {
  const { ready, userId } = useAuth();
  if (!ready) return <Splash />;
  if (!userId) return <Login />;
  return (
    <SupabaseStoreProvider>
      <AppRoutes />
    </SupabaseStoreProvider>
  );
}

// Modo local: sin login (datos en este dispositivo)
function LocalApp() {
  return (
    <StoreProvider>
      <AppRoutes />
    </StoreProvider>
  );
}

export default function App() {
  if (!hasSupabase) return <LocalApp />;
  return (
    <AuthProvider>
      <CloudApp />
    </AuthProvider>
  );
}

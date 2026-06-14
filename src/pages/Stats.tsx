import { useMemo } from "react";
import { useStore } from "../store";
import {
  spendingByMonth,
  avgMonthlySpend,
  projectNextMonths,
  byCategory,
  contributionByUser,
  totalExpected,
  isDebtActiveIn,
} from "../lib/finance";
import {
  currentPeriod,
  formatCOP,
  formatCompact,
  periodShort,
  periodLabel,
} from "../lib/format";
import { StatCard } from "../components/ui";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, Calendar, Wallet, Trophy } from "lucide-react";

export default function Stats() {
  const { debts, payments, users, categories } = useStore();
  const period = currentPeriod();
  const catBy = (id: string) =>
    categories.find((c) => c.id === id) ?? {
      label: "Sin categoría",
      color: "#94a3b8",
    };

  const history = useMemo(() => spendingByMonth(payments, 6), [payments]);
  const avg = useMemo(() => avgMonthlySpend(payments), [payments]);
  const nextMonth = useMemo(
    () => projectNextMonths(debts, payments, 1)[0],
    [debts, payments]
  );
  const cats = useMemo(
    () => byCategory(debts, period, payments),
    [debts, period, payments]
  );
  const contrib = useMemo(() => contributionByUser(payments, 6), [payments]);

  const monthExpected = totalExpected(
    debts.filter((d) => isDebtActiveIn(d, period)),
    period,
    payments
  );
  const projTotal = nextMonth?.total ?? 0;

  // datos para gráficas
  const histData = history.map((h) => ({
    name: periodShort(h.period),
    total: Math.round(h.total),
  }));

  const catData = Object.entries(cats)
    .map(([id, value]) => ({
      id,
      name: catBy(id).label,
      value: Math.round(value),
      color: catBy(id).color,
    }))
    .sort((a, b) => b.value - a.value);

  // deuda más cara al año
  const priciest = [...debts]
    .filter((d) => isDebtActiveIn(d, period))
    .sort(
      (a, b) =>
        annualCost(b, period) - annualCost(a, period)
    )[0];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Estadísticas</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Gasto este mes"
          value={formatCOP(monthExpected)}
          icon={<Wallet className="w-4.5 h-4.5" />}
          accent="#8184f8"
        />
        <StatCard
          label="Promedio mensual"
          value={formatCOP(avg)}
          sub={<span className="text-muted">últimos 6 meses</span>}
          icon={<Calendar className="w-4.5 h-4.5" />}
          accent="#38bdf8"
        />
        <StatCard
          label="Proyección próx. mes"
          value={formatCOP(projTotal)}
          sub={
            nextMonth && (
              <span className="text-muted">{periodLabel(nextMonth.period)}</span>
            )
          }
          icon={<TrendingUp className="w-4.5 h-4.5" />}
          accent="#34d399"
        />
        <StatCard
          label="Más cara (anual)"
          value={priciest ? formatCOP(annualCost(priciest, period)) : "—"}
          sub={priciest && <span className="text-muted">{priciest.name}</span>}
          icon={<Trophy className="w-4.5 h-4.5" />}
          accent="#facc15"
        />
      </div>

      {/* Histórico */}
      <ChartCard title="Gasto mes a mes" subtitle="Lo que has pagado">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={histData} margin={{ top: 8, right: 8, left: 8 }}>
            <XAxis dataKey="name" stroke="rgb(var(--muted))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke="rgb(var(--muted))"
              fontSize={12}
              tickFormatter={formatCompact}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<MoneyTip />} cursor={{ fill: "rgb(var(--surface-2))" }} />
            <Bar dataKey="total" fill="#8184f8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Proyección del próximo mes con desglose */}
      <ChartCard
        title={`Proyección · ${nextMonth ? periodLabel(nextMonth.period) : "próximo mes"}`}
        subtitle="Cuotas comprometidas + colchón variable del histórico"
      >
        <div className="flex items-end justify-between mb-4">
          <div className="text-3xl font-extrabold tracking-tight">
            {formatCOP(projTotal)}
          </div>
          <div className="text-sm text-muted">estimado a pagar</div>
        </div>
        {/* barra apilada horizontal */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-surface-2">
          <div
            className="h-full"
            style={{
              width: projTotal ? `${((nextMonth?.committed ?? 0) / projTotal) * 100}%` : "0%",
              backgroundColor: "#8184f8",
            }}
          />
          <div
            className="h-full"
            style={{
              width: projTotal ? `${((nextMonth?.variable ?? 0) / projTotal) * 100}%` : "0%",
              backgroundColor: "#38bdf8",
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-surface-2 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#8184f8" }} />
              Comprometido
            </div>
            <div className="font-bold mt-0.5">{formatCOP(nextMonth?.committed ?? 0)}</div>
            <div className="text-[11px] text-muted">cuotas y fijos seguros</div>
          </div>
          <div className="bg-surface-2 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#38bdf8" }} />
              Variable
            </div>
            <div className="font-bold mt-0.5">{formatCOP(nextMonth?.variable ?? 0)}</div>
            <div className="text-[11px] text-muted">colchón por tu histórico</div>
          </div>
        </div>
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Por categoría */}
        <ChartCard title="Gasto por categoría" subtitle="Este mes">
          {catData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={catData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {catData.map((c) => (
                    <Cell key={c.id} fill={c.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<MoneyTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Aporte por persona */}
        <ChartCard title="Aporte por persona" subtitle="Últimos 6 meses">
          <div className="flex flex-col gap-3 pt-2">
            {users.map((u) => {
              const val = contrib[u.id] ?? 0;
              const max = Math.max(1, ...Object.values(contrib));
              return (
                <div key={u.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full grid place-items-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: u.color }}
                      >
                        {u.name.charAt(0)}
                      </span>
                      {u.name}
                    </span>
                    <span className="font-bold">{formatCOP(val)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(val / max) * 100}%`,
                        backgroundColor: u.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function annualCost(d: { amount: number; frequency: string }, _period: string) {
  const mult =
    d.frequency === "weekly" ? 52 : d.frequency === "biweekly" ? 24 : 12;
  return d.amount * mult;
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-3">
        <h2 className="font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function MoneyTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-2.5 text-sm shadow-lg">
      {label && <div className="font-semibold mb-1">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: p.color || p.payload.color }}
          />
          <span className="text-muted">{p.name}:</span>
          <span className="font-semibold">{formatCOP(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="h-[240px] grid place-items-center text-muted text-sm">
      Sin datos este mes
    </div>
  );
}

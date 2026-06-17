import { useState } from "react";
import { useStore } from "../store";
import type { Category } from "../types";
import { readableText } from "../lib/format";
import { Icon } from "../components/ui";
import NotificationSettings from "../components/NotificationSettings";
import CurrencySettings from "../components/CurrencySettings";
import { Plus, Trash2, Check, X } from "lucide-react";

// Conjunto de íconos disponibles para elegir.
const ICONS = [
  "Zap", "CreditCard", "Landmark", "Repeat", "Home", "Car", "User", "Tag",
  "ShoppingCart", "Utensils", "Plane", "HeartPulse", "GraduationCap", "Wifi",
  "Phone", "Gift", "Dog", "Dumbbell", "Film", "Fuel", "Banknote", "PiggyBank",
];

const PALETTE = [
  "#22d3ee", "#4ade80", "#fde047", "#fb923c", "#f472b6", "#c084fc",
  "#60a5fa", "#f87171", "#34d399", "#a3e635", "#fbbf24", "#cbd5e1",
];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export default function Admin() {
  const { categories, debts, addCategory, updateCategory, deleteCategory } =
    useStore();
  const [adding, setAdding] = useState(false);

  const usage = (slug: string) =>
    debts.filter((d) => !d.archived && d.category === slug).length;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Administración</h1>

      <CurrencySettings />

      <NotificationSettings />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Categorías</h2>
          <button className="btn-primary !py-2" onClick={() => setAdding(true)}>
            <Plus className="w-4.5 h-4.5" /> Agregar
          </button>
        </div>

        {adding && (
          <AddCategory
            existing={categories}
            onCancel={() => setAdding(false)}
            onCreate={(cat) => {
              addCategory(cat);
              setAdding(false);
            }}
          />
        )}

        <div className="flex flex-col gap-2 mt-2">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              cat={c}
              usage={usage(c.id)}
              onUpdate={updateCategory}
              onDelete={() => deleteCategory(c.id)}
            />
          ))}
          {categories.length === 0 && (
            <div className="card p-6 text-center text-muted text-sm">
              No hay categorías. Agrega la primera.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  cat,
  usage,
  onUpdate,
  onDelete,
}: {
  cat: Category;
  usage: number;
  onUpdate: (c: Category) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(cat.label);
  const [confirm, setConfirm] = useState(false);
  const [pickIcon, setPickIcon] = useState(false);

  return (
    <div className="card p-3">
      <div className="flex items-center gap-2">
        {/* preview del tag */}
        <span
          className="chip font-semibold min-w-0 flex-1"
          style={{ backgroundColor: cat.color, color: readableText(cat.color) }}
        >
          <Icon name={cat.icon} className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{label || "—"}</span>
        </span>

        {/* ícono */}
        <button
          className="btn-ghost !px-2.5 !py-2 shrink-0"
          onClick={() => setPickIcon((v) => !v)}
          title="Cambiar ícono"
        >
          <Icon name={cat.icon} className="w-4.5 h-4.5" />
        </button>

        {/* color */}
        <label
          className="w-8 h-8 rounded-lg shrink-0 cursor-pointer border border-border"
          style={{ backgroundColor: cat.color }}
          title="Cambiar color"
        >
          <input
            type="color"
            className="opacity-0 w-0 h-0"
            value={cat.color}
            onChange={(e) => onUpdate({ ...cat, color: e.target.value })}
          />
        </label>

        {!confirm && (
          <button
            className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 shrink-0"
            onClick={() => setConfirm(true)}
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <input
        className="input !py-2 mt-2"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label.trim() && onUpdate({ ...cat, label: label.trim() })}
      />

      {/* selector de paleta + íconos */}
      {pickIcon && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => {
                  onUpdate({ ...cat, icon: ic });
                  setPickIcon(false);
                }}
                className={`p-2 rounded-lg border ${
                  cat.icon === ic
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border text-muted hover:text-text"
                }`}
              >
                <Icon name={ic} className="w-4 h-4" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((col) => (
              <button
                key={col}
                onClick={() => onUpdate({ ...cat, color: col })}
                className="w-6 h-6 rounded-full border border-border"
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <div className="mt-3 rounded-xl bg-red-500/10 p-3">
          <p className="text-sm text-red-300 mb-2">
            ¿Eliminar la categoría <b>{cat.label}</b>?
            {usage > 0 && (
              <>
                {" "}
                {usage} {usage === 1 ? "deuda la usa" : "deudas la usan"} y
                quedarán sin categoría.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-ghost flex-1 !py-2 text-sm"
              onClick={() => setConfirm(false)}
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              className="btn flex-1 !py-2 text-sm bg-red-500 text-white hover:opacity-90"
              onClick={onDelete}
            >
              <Check className="w-4 h-4" /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddCategory({
  existing,
  onCreate,
  onCancel,
}: {
  existing: Category[];
  onCreate: (c: Category) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [icon, setIcon] = useState("Tag");

  function create() {
    const name = label.trim();
    if (!name) return;
    let slug = slugify(name) || "cat";
    // asegurar unicidad
    const ids = new Set(existing.map((c) => c.id));
    if (ids.has(slug)) {
      let n = 2;
      while (ids.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    onCreate({ id: slug, label: name, color, icon });
  }

  return (
    <div className="card p-4 mb-2 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="chip font-semibold shrink-0"
          style={{ backgroundColor: color, color: readableText(color) }}
        >
          <Icon name={icon} className="w-3.5 h-3.5" />
          {label || "Nueva"}
        </span>
        <input
          className="input !py-2 flex-1"
          placeholder="Nombre de la categoría"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <div className="text-xs text-muted mb-1.5">Ícono</div>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              className={`p-2 rounded-lg border ${
                icon === ic
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              <Icon name={ic} className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-muted mb-1.5">Color</div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {PALETTE.map((col) => (
            <button
              key={col}
              onClick={() => setColor(col)}
              className={`w-7 h-7 rounded-full border-2 ${
                color === col ? "border-text" : "border-transparent"
              }`}
              style={{ backgroundColor: col }}
            />
          ))}
          <label
            className="w-7 h-7 rounded-full border border-border cursor-pointer grid place-items-center text-muted"
            title="Personalizado"
          >
            +
            <input
              type="color"
              className="opacity-0 w-0 h-0"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn-primary flex-1" disabled={!label.trim()} onClick={create}>
          Crear categoría
        </button>
      </div>
    </div>
  );
}

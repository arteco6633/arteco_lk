export function PartSearchField({
  value,
  onChange,
  hint,
  placeholder = "Поз. (код), штрихкод, название, размер…",
}: {
  value: string;
  onChange: (v: string) => void;
  hint: string;
  placeholder?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-6">
      <label className="block text-sm font-bold text-black mb-2">Поиск детали</label>
      <input
        type="search"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-black placeholder:text-slate-500 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
      />
      <p className="text-sm font-medium text-black mt-2">{hint}</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Ошибка входа");
      return;
    }

    router.push(data.redirect);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-black">Mebel Flow</h1>
          <p className="font-medium text-black mt-2">Учёт производства мебели</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-black mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-black"
              placeholder="manager@mebel.local"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-1">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-black"
              placeholder="••••••"
            />
          </div>

          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 text-white py-3 text-base font-bold hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm font-medium text-black">
          <p className="font-bold mb-2">Демо-доступ (пароль: 123456)</p>
          <ul className="space-y-1">
            <li>manager@mebel.local — менеджер</li>
            <li>contractor@mebel.local — приёмка</li>
            <li>sorter@mebel.local — сортировка</li>
            <li>driller@mebel.local — присадка</li>
            <li>qc@mebel.local — ОКК</li>
            <li>packer@mebel.local — упаковка</li>
            <li>admin@mebel.local — администратор (дашборд)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

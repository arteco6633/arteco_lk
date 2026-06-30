"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
    >
      Выйти
    </button>
  );
}

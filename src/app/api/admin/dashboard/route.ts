import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard";
import { requireSessionFromDb } from "@/lib/session";

export async function GET() {
  const user = await requireSessionFromDb();
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ только для администратора" }, { status: 403 });
  }

  const data = await getDashboardData();
  return NextResponse.json(data);
}

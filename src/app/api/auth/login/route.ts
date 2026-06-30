import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { homeForRole } from "@/lib/constants";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await login(body.email ?? "", body.password ?? "");

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    redirect: homeForRole(result.user.role),
  });
}

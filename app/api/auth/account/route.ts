import { NextResponse } from "next/server";
import {
  deleteAppUserAccount,
  destroySession,
  getAuthSession,
  SESSION_COOKIE,
} from "@/lib/auth";

/** Delete the signed-in user's Settlor account (not the on-chain Circle wallet). */
export async function DELETE() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteAppUserAccount(session.user.id);
    await destroySession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not delete account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

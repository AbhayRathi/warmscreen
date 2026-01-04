import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { email, name } = await req.json();
  cookies().set("user_email", email, { httpOnly: true, maxAge: 86400 });
  cookies().set("user_name", name, { httpOnly: true, maxAge: 86400 });
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { oauthEnabled } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ oauth: oauthEnabled() });
}

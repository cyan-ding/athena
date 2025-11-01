import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import Database from "better-sqlite3";
import path from "path";
import type { NextRequest } from "next/server";

const dbPath = path.join(process.cwd(), "auth.db");

const auth = betterAuth({
  database: new Database(dbPath),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 1,
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: [
    process.env.SITE_URL || "http://localhost:3000",
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "http://localhost:3000",
  ],
  plugins: [nextCookies()],
});

export async function GET(request: NextRequest) {
  return auth.handler(request);
}

export async function POST(request: NextRequest) {
  return auth.handler(request);
}

import { convexAdapter } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth";
import { components } from "./_generated/api";
import type { GenericActionCtx, GenericDataModel } from "convex/server";

export const createAuth = (ctx: GenericActionCtx<GenericDataModel>) => {
  return betterAuth({
    database: convexAdapter(ctx, components.betterAuth),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    trustedOrigins: [process.env.SITE_URL || "http://localhost:3000"],
  });
};

// Export a static auth instance for API routes
export const auth = createAuth({} as GenericActionCtx<GenericDataModel>);

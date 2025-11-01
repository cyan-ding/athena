export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://supreme-sheepdog-74.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};

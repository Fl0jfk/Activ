import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/association",
  "/disciplines(.*)",
  "/preinscription",
  "/piece-jointe",
  "/api/site-data",
  "/api/public-preinscriptions",
  "/api/public-temp-documents",
  "/api/public-document-upload",
  "/sign-in(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|png|gif|svg|ttf|woff2?|ico)).*)", "/(api|trpc)(.*)"],
};

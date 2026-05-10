// Browser-side Better Auth client.
//
// Importable from <script> blocks in .astro pages. Talks to the same
// /api/auth/* endpoints exposed by the server. Don't put server-only secrets
// in this file — anything imported here ends up in client bundles.

import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // baseURL defaults to the page's origin which is what we want.
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;

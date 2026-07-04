import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { withPrivileged } from "@/lib/db/client";

const handlers = toNextJsHandler(auth);

// Better Auth's signup hooks (databaseHooks.user.create.after) call services
// that use the global `db`. Run the whole auth handler on the privileged
// connection so those reads/writes bypass RLS — auth runs before request
// identity exists, so there is no `app.current_user_id` to scope by.
export function GET(request: Request) {
  return withPrivileged(() => handlers.GET(request));
}

export function POST(request: Request) {
  return withPrivileged(() => handlers.POST(request));
}

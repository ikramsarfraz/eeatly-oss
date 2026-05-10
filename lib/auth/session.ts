import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env/server";
import type { UserRole } from "@/types";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role: (session.user.role as UserRole | undefined) ?? "root_app_user"
    };
  } catch {
    return null;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function requirePlatformAdmin() {
  const user = await requireCurrentUser();
  const requestHeaders = await headers();
  const configuredAdminHost = getServerEnv().PLATFORM_ADMIN_HOST?.toLowerCase();
  const requestHost = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  ).toLowerCase();

  if (configuredAdminHost && requestHost !== configuredAdminHost) {
    notFound();
  }

  if (user.role !== "platform_admin") {
    notFound();
  }

  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return user;
}

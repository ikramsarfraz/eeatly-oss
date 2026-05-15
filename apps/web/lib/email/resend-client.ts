import "server-only";

import { Resend } from "resend";
import { getServerEnv } from "@/lib/env/server";

export function getResendClient() {
  const { RESEND_API_KEY } = getServerEnv();

  if (!RESEND_API_KEY) {
    return null;
  }

  return new Resend(RESEND_API_KEY);
}

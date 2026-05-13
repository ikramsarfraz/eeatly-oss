import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env/server";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: getServerEnv().ANTHROPIC_API_KEY });
  }
  return _client;
}

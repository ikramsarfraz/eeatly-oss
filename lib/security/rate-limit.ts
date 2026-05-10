type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

export async function checkRateLimit(input: RateLimitInput) {
  void input;
  // Placeholder for Redis/Vercel KV backed rate limiting.
  // Keep the call site async so a real store can be added without API changes.
  return { success: true };
}

#!/usr/bin/env bash
echo "Branch: $VERCEL_GIT_COMMIT_REF"
case "$VERCEL_GIT_COMMIT_REF" in
  main|develop|release/*)
    echo "✅ Allowed branch — build proceeding"
    exit 1
    ;;
  *)
    echo "🛑 Branch not in allowlist — skipping"
    exit 0
    ;;
esac

#!/usr/bin/env bash
# PreToolUse Bash hook: roda build + test + smoke antes de qualquer `git push`.
# SDK distribui via CDN — bundle quebrado vira incidente assim que jsdelivr cacheia.

set -u

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

# Só intercepta `git push` (não `git pull`, `git fetch`, etc.).
if ! printf '%s' "$cmd" | grep -qE '(^|[[:space:]&;|()]+)git[[:space:]]+push([[:space:]]|$)'; then
  exit 0
fi

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Pre-push gate: não consegui localizar o root do repo via git rev-parse."
    }
  }'
  exit 0
}

cd "$root" || exit 0

# Roda em sequência. Se qualquer um falhar, bloqueia o push.
log=$(mktemp -t prepushgate.XXXXXX)
trap 'rm -f "$log"' EXIT

if npm run build >"$log" 2>&1 && \
   npm run test >>"$log" 2>&1 && \
   npm run test:smoke >>"$log" 2>&1; then
  exit 0
fi

# Pega últimas linhas do log para o motivo.
tail=$(tail -n 40 "$log")

jq -n --arg tail "$tail" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: ("Pre-push gate falhou — build OU test OU test:smoke não passou. " +
      "Esse SDK distribui via CDN, então push de bundle quebrado vira incidente. " +
      "Últimas linhas do log:\n\n" + $tail)
  }
}'
exit 0

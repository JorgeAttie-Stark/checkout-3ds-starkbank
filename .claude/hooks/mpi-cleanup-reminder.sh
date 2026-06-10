#!/usr/bin/env bash
# PostToolUse Edit|Write hook: lembra do checklist canary cleanup quando
# alguém edita src/adapters/mpi/*. Não bloqueia — injeta contexto.

set -u

input=$(cat)
fp=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // ""')

case "$fp" in
  */src/adapters/mpi/*)
    msg="Você editou ${fp} — invariante MPI crítico (CLAUDE.md).
Checklist canary cleanup antes de declarar pronto:
  1. cleanup() é chamado no path de SUCESSO?
  2. cleanup() é chamado no path de FALHA?
  3. cleanup() é chamado no path de TIMEOUT?
  4. tests/adapters/mpi/browser-adapter.test.js (canary) passa?
Se qualquer resposta for negativa ou incerta, PARE e revise antes de seguir. Script Braspag MPI é single-session; deixar <script> no DOM trava a próxima authenticate()."
    jq -n --arg msg "$msg" '{
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: $msg
      }
    }'
    ;;
esac

exit 0

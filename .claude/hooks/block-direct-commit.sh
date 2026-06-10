#!/usr/bin/env bash
# PreToolUse Bash hook: bloqueia `git commit` direto em main/develop.
# Permite `git merge`, `git push`, etc. NÃO bloqueia commits em outras branches.

set -u

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

# Detecta `git commit` em qualquer posição do comando (chain com &&, ;, |, no início, etc.).
# Não casa `git commit-tree`, `git merge`, `git push`.
if printf '%s' "$cmd" | grep -qE '(^|[[:space:]&;|()]+)git[[:space:]]+commit([[:space:]]|$)'; then
  branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
  if [ "$branch" = "main" ] || [ "$branch" = "develop" ]; then
    jq -n --arg branch "$branch" '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("Gitflow: commit direto em '\''" + $branch + "'\'' bloqueado. " +
          "main só recebe merge de release/* ou hotfix/*; develop recebe merge de feature/*. " +
          "Crie uma branch: git checkout -b feature/<slug> (a partir de develop) " +
          "ou hotfix/<slug> (a partir de main). Ver CONTRIBUTING.md.")
      }
    }'
    exit 0
  fi
fi

exit 0

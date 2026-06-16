# Contribuindo — `@starkbank/checkout-3ds`

## Gitflow

Usamos **Gitflow** adaptado ao escopo de SDK (release pequena, deploy via CDN/npm).

```
main           ← produção. Cada commit aqui pode virar release/tag/CDN.
develop        ← integração contínua. Base de toda feature.
feature/*      ← novas features. Branch de develop. Merge → develop via PR.
release/*      ← preparação de release. Branch de develop. Merge → main + develop.
hotfix/*       ← fix urgente em produção. Branch de main. Merge → main + develop.
```

### Branches permanentes

| Branch    | Protegida | Direct push? | Origem dos merges                  |
| --------- | --------- | ------------ | ---------------------------------- |
| `main`    | sim       | **não**      | `release/*`, `hotfix/*`            |
| `develop` | sim       | **não**      | `feature/*`, `release/*`, `hotfix/*` |

`main` é deployável **sempre**. Se o último commit em `main` não pode ir pra CDN, é bug — investigar.

---

### Convenção de nome de branch

```
feature/<slug-curto>             ex: feature/mpi-script-loader
fix/<slug-curto>                 ex: fix/cleanup-on-timeout
hotfix/<slug-curto>              ex: hotfix/iframe-leak
release/<versão>                 ex: release/1.0.0
chore/<slug-curto>               ex: chore/update-vitest
docs/<slug-curto>                ex: docs/readme-cdn
```

Slugs em **kebab-case**, sem nome de pessoa, sem número de ticket cru — descreva o **que muda**.

---

### Fluxo de feature

```bash
git checkout develop
git pull
git checkout -b feature/minha-feature

# trabalhe, commits pequenos
git push -u origin feature/minha-feature
# abrir PR → develop
```

PR aprovada → **squash merge** em `develop` (mantém histórico de `develop` linear).

---

### Fluxo de release

```bash
git checkout develop
git pull
git checkout -b release/1.0.0

# bump em package.json, CHANGELOG.md, ajustes finais
# rodar npm run build && npm run test && npm run test:smoke
git push -u origin release/1.0.0
# abrir PR → main
```

PR aprovada → **merge commit** (preserva histórico) em `main`, criar tag `v1.0.0`, depois **back-merge `main` → `develop`**.

```bash
git checkout main && git pull
git tag -a v1.0.0 -m "release v1.0.0"
git push origin v1.0.0

git checkout develop && git pull
git merge --no-ff main
git push
```

---

### Fluxo de hotfix

```bash
git checkout main
git pull
git checkout -b hotfix/iframe-leak

# fix mínimo + teste
git push -u origin hotfix/iframe-leak
# abrir PR → main
```

Após merge em `main`: tag patch (ex: `v1.0.1`) e **back-merge `main` → `develop`**.

---

## Convenção de commit

Estilo livre, mas siga o padrão do projeto (rode `git log --oneline -20` antes do primeiro commit pra calibrar). Recomendado:

```
<tipo>: <imperativo curto, minúsculo>

[corpo opcional explicando o porquê]
```

Tipos comuns: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`.

Exemplos bons:

```
feat: validar currency no input
fix: limpar script 3DS também em path de timeout
refactor: extrair URLs do gateway para core/constants
```

---

## Regras de PR

- **PR tem escopo único e revisável** — uma feature, um fix, ou uma camada por vez.
- **1 subpasta `adapters/mpi/*` por PR** quando o trabalho mexer nessa camada.
- Nunca misturar `services/authenticate.js` + `adapters/mpi/*` na mesma PR.
- PRs que tocam `adapters/mpi/*`: checklist canary cleanup explícito (ver [CLAUDE.md](./CLAUDE.md#prs-que-tocam-srcadaptersmpi)).
- Build + testes verdes antes de marcar "ready for review":

```bash
npm run build
npm run test
npm run test:smoke
```

- PR descreve **o que** muda e **por que**. **Como** está no diff.

---

## Versionamento

[SemVer](https://semver.org/lang/pt-BR/):

- `MAJOR` — quebra de API pública (`Stark3DS.authenticate`, helpers, classes de erro).
- `MINOR` — feature retrocompatível (ex: novo parâmetro opcional, novo helper).
- `PATCH` — bugfix retrocompatível.

V1 começa em `1.0.0`. Pré-release: `1.0.0-alpha.N`, `1.0.0-rc.N`.

---

## Setup local

```bash
nvm use                  # Node 20
npm install
npm run build            # ESM + CJS + IIFE
npm run test             # unit
npm run test:smoke       # bundle CDN
```

Distribuição v1 é **CDN-only** — ver [README.md](./README.md#instalação) e [CLAUDE.md](./CLAUDE.md#escopo-v1--cdn-only).

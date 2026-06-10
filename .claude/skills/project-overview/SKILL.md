---
name: project-overview
description: Visão completa do projeto `@starkbank/checkout-3ds` neste repo (`starkbank-3ds-checkout`, to-be rewrite v2 JS puro) e sua relação com o as-is TypeScript (`starkbank-checkout`, congelado). Cobre estado atual, gitflow, hooks Claude Code instalados, branch protection, invariante MPI single-shot, contrato público, estrutura alvo, fases do rewrite, comandos comuns, ecossistema de homolog. Aplica para qualquer trabalho neste repo, perguntas sobre "onde mexer", decisões de arquitetura, ou orientação geral do projeto. Use **proactively** ao começar uma sessão neste repo.
---

# `checkout-3ds-starkbank` — entendimento do projeto

## 1. Os dois repos (contexto cross-repo)

| Repo | Path | Linguagem | Status | Quando mexer |
|---|---|---|---|---|
| **`checkout-3ds-starkbank`** (este) | `/Users/jorge.attie/starkbank-3ds-checkout/` | JavaScript puro, sem `.d.ts` | **Ativo** — rewrite v2 em andamento | Tudo de desenvolvimento futuro |
| `starkbank-checkout` (as-is) | `/Users/jorge.attie/starkbank-checkout/` | TypeScript | **Congelado** em v1.0.0 até cutover (Fase 5) | Só hotfix de v1 |

GitHub remote (este repo): `git@github.com:JorgeAttie-Stark/checkout-3ds-starkbank.git`

**Regra:** rewrite/fases/features novas vão neste repo. As-is é só fonte de verdade do comportamento (e hotfix raro de v1). **Nunca refatorar o as-is** — congelado por decisão.

---

## 2. Estado atual deste repo

- **Branches remotas:** `main` e `develop` (atenção: **`develop`**, sem `ment` — ruleset do GitHub bateu nesse erro antes).
- **Pacote npm:** `@starkbank/checkout-3ds@1.0.0-alpha.0`. Mesmo nome do as-is — cutover é bump de versão (`1.x` → `2.x`).
- **Distribuição v1:** **CDN-only.** Build gera ESM + CJS pra não fechar a porta de publicação npm futura, mas `npm publish` não roda na v1.
- **Build:** `esbuild` direto via `build.config.mjs`. 3 alvos:
  - `dist/index.js` (ESM) ← `src/api/index.js`
  - `dist/index.cjs` (CJS) ← `src/api/index.js`
  - `dist/checkout-3ds.min.js` (IIFE → `window.Stark3DS`) ← `src/api/cdn.js`
- **Testes:** `vitest` + `jsdom`. Estado: 4/4 unit (api/index) + 3/3 smoke CDN.
- **Estrutura alvo já aplicada** desde a Fase 0 (`api/services/validation/config/adapters/utils/core/testing`). **Não é híbrida.**
- **Runtime deps:** zero. DevDeps: `esbuild`, `vitest`, `jsdom`.
- **Node:** 20 (`.nvmrc`).

### O que existe hoje (Fase 0 concluída)

```
src/
├── api/
│   ├── cdn.js              ← IIFE → window.Stark3DS
│   ├── helpers.js          ← isAuthenticated, toChallengeResult
│   └── index.js            ← npm: named exports
├── services/
│   └── authenticate.js     ← STUB (lança "not implemented")
├── core/
│   ├── constants.js        ← MPI_SCRIPT_URLS, MPI_SCRIPT_ELEMENT_ID, DEFAULT_AUTHENTICATE_TIMEOUT_MS
│   └── errors.js           ← 3 classes de erro
├── utils/
│   └── eci.js              ← isLiabilityShiftToIssuer (pura, completa)
├── adapters/mpi/           ← VAZIO (Fase 3)
├── validation/             ← VAZIO (Fase 1)
├── config/                 ← VAZIO (Fase 1)
└── testing/                ← VAZIO (Fase 2)
```

---

## 3. Convenção de branches (Gitflow)

Documentada em `CONTRIBUTING.md`. Resumo:

| Branch | Protegida | Direct push? | Origem dos merges |
|---|---|---|---|
| `main` | ✅ (GitHub ruleset `protect-main`) | **não** | `release/*`, `hotfix/*` |
| `develop` | ✅ (GitHub ruleset `protect-develop`) | **não** | `feature/*`, `release/*`, `hotfix/*` |

**Default branch no GitHub: `develop`** (PRs apontam pra ela por default).

### Branches efêmeras (kebab-case)

| Pattern | Off de | Merge em | Quando |
|---|---|---|---|
| `feature/<slug>` | `develop` | `develop` (squash) | Features, fases do rewrite, refactors não-urgentes |
| `fix/<slug>` | `develop` | `develop` (squash) | Bugs não-críticos |
| `hotfix/<slug>` | `main` | `main` + back-merge `develop` | Fix urgente em produção (tag patch obrigatório) |
| `release/<versão>` | `develop` | `main` (merge commit) + back-merge `develop` | Preparação de release |
| `chore/<slug>`, `docs/<slug>` | `develop` | `develop` | Manutenção |

### Versionamento

SemVer. V1 começa em `1.0.0` (atualmente `1.0.0-alpha.0`). Pré-releases: `1.0.0-alpha.N`, `1.0.0-rc.N`. Tag git **sempre** bate com `package.json`.

---

## 4. Hooks Claude Code instalados

Em `.claude/hooks/` + config compartilhada em `.claude/settings.json` (committed, time herda):

| Hook | Evento | Comportamento |
|---|---|---|
| `block-direct-commit.sh` | `PreToolUse` Bash | Bloqueia `git commit` se branch atual = `main`/`develop` |
| `pre-push-gate.sh` | `PreToolUse` Bash | Roda `npm run build && npm run test && npm run test:smoke` antes de qualquer `git push`. Falhou → bloqueia |
| `mpi-cleanup-reminder.sh` | `PostToolUse` Edit/Write | Injeta checklist canary cleanup quando file_path contém `src/adapters/mpi/` |

`.claude/settings.local.json` é pessoal (gitignored). Hooks só rodam pra quem usa Claude Code; quem clona/usa git normal não é afetado. **Hooks nunca vão pro bundle CDN/npm** (`package.json` "files" só inclui `dist/`).

---

## 5. Invariante MPI — não-negociável

O script Braspag `BP.Mpi.3ds20.min.js` registra `window.bpmpi_authenticate` com **estado single-shot**: chamar de novo na mesma página sem reload do script **não dispara callback** — Promise estoura no timeout (~120s) com `Stark3DSAuthenticateTimeoutError`.

### Contrato

O `BrowserMpiAdapter` (em `src/adapters/mpi/browser-adapter.js`, Fase 3) **deve** chamar `cleanup()` em **todo** settle path: sucesso, falha, timeout. O `cleanup()` chama `clearScriptLoadState()` em `src/adapters/mpi/script-loader.js`, que:

1. Remove `<script id="starkbank-checkout-3ds-script">` do DOM (ID em `core/constants.js#MPI_SCRIPT_ELEMENT_ID`).
2. Zera `loadPromise` module-level.
3. Deleta `window.bpmpi_authenticate` e `window.bpmpi_config`.

No modo iframe isolado (default `isolateRuntime: true`), cleanup acontece **dentro do iframe** antes do iframe ser destruído.

### Regras

- **Nunca otimizar mantendo o script no DOM entre auths.** O cache HTTP do Braspag torna re-injeção ~0ms. O problema é estado interno do MPI, não rede.
- **Teste canary obrigatório:** `BrowserMpiAdapter cleanup between authenticates` — `tests/adapters/mpi/browser-adapter.test.js` (a portar na Fase 3 do as-is `packages/checkout-3ds/src/mpi/__tests__/mpi-adapter.test.ts`).
- O hook `mpi-cleanup-reminder.sh` injeta checklist a cada edit no diretório — não substitui o teste.

---

## 6. Contrato público — preservar 100% no rewrite

### Exports (mesmos do as-is)

| Export | O que faz |
|---|---|
| `Stark3DS.authenticate(input)` | `Promise<{ authentication, challenge? }>` |
| `Stark3DS.isLiabilityShiftToIssuer(eci)` | helper ECI |
| `isAuthenticated(output)` | `boolean` — true só se `authenticated` E `challenge` presente |
| `toChallengeResult(output)` | extrai `{ cavv, eci, version, xid, referenceId }` ou lança |
| `Stark3DSError` | erro base |
| `Stark3DSValidationError` | input/config inválidos |
| `Stark3DSAuthenticateTimeoutError` | timeout (~120s) |

CDN (`api/cdn.js`) também expõe aliases `Error`, `ValidationError`, `AuthenticateTimeoutError`.

### Semântica de erros

- **Lança:** input inválido, config inválida (`Stark3DSValidationError`), timeout (`Stark3DSAuthenticateTimeoutError`).
- **Não lança** (resolve a Promise): `failed`, `unenrolled`, `disabled`, `unsupported_brand`, `error`. Caller checa via `isAuthenticated()`.

### ECI — liability shift

`isLiabilityShiftToIssuer(eci)` retorna `true` para ECI **`01`, `02`, `05`** (não só 02/05). Normaliza com `padStart(2, "0")`. Ver skill `cielo-mpi-3ds` § 7 para detalhes.

### `@internal` — nunca expor

`__configure`, `__setAdapterFactory`, `__resetAdapterFactory`, tudo de `adapters/mpi/`, qualquer `bpmpi_*`.

---

## 7. Estrutura alvo (PLANO-ARQUITETURA-V2)

Já aplicada desde Fase 0:

```
src/
├── api/          # Re-exports puros. Zero lógica.
├── services/     # Orquestração (caso de uso)
├── validation/   # Tudo que lança ValidationError
├── config/       # Resolução de ambiente e defaults
├── adapters/mpi/ # Integração Braspag (browser-adapter, script-loader, iframe, dom-builder, callbacks)
├── utils/        # Puros: auth-queue, timeout, currency, eci, iso4217 (GERADO)
├── core/         # Fundação: errors.js, constants.js
└── testing/      # Doubles (não publicar no bundle merchant)
```

Meta: ~16 arquivos de produção, ~1.200–1.300 LOC. **Não esperar** redução de 50% vs as-is — complexidade real é Braspag, não TypeScript.

Resumo por pasta — ver "Mental model" em `PLANO-ARQUITETURA-V2.md`:

| Pasta | Pergunta | Pode ter DOM/IO? |
|---|---|---|
| `api/` | O que o integrador importa? | Não (só re-exports) |
| `services/` | Qual caso de uso? | Orquestra; não toca DOM MPI |
| `adapters/mpi/` | Com quem falamos por fora? | **Sim — único lugar com DOM MPI / Braspag** |
| `utils/` | Helpers puros / infra genérica? | Sem DOM MPI |
| outras | — | Não |

---

## 8. Fases do rewrite

Definidas em `PLANO-REFATORACAO.md` (no as-is). Estado:

| Fase | Escopo | Status | Branch |
|---|---|---|---|
| **0** — Bootstrap | repo + build + smoke verde | ✅ feito (commit `c682ca8`) | `feature/setup-hooks` mergeada |
| **1** — Camadas finas | `validation/input`, `config/environment`, `utils/auth-queue`, `utils/timeout` | ⏳ próximo | `feature/fase1-camadas-finas` (sugerido) |
| **2** — Service + fake | `services/authenticate`, `testing/fake-mpi-adapter` | ⏳ | `feature/fase2-service-fake` |
| **3** — Núcleo MPI (**alto risco**) | `adapters/mpi/*` 1:1 com as-is, canary cleanup | ⏳ | `feature/fase3-mpi-*` |
| **4** — Consolidação | merge de micro-arquivos, remover deprecated | ⏳ | `feature/fase4-consolidacao` |
| **5** — Homolog + cutover | E2E + publica v2 + arquiva as-is | ⏳ | `feature/fase5-cutover` |

Total estimado: ~2–3 semanas. **Fase 3 é o risco real.**

PR rule: **1 fase OU 1 subpasta `adapters/mpi/*` por PR.** Nunca refatorar `services/authenticate.js` + `adapters/mpi/*` na mesma PR.

---

## 9. Comandos comuns

```bash
nvm use                  # Node 20
npm install
npm run build            # esbuild → dist/ (ESM + CJS + IIFE)
npm test                 # vitest unit
npm run test:smoke       # smoke do CDN bundle
npm run test:watch       # vitest watch
npm run generate:iso4217 # regenera src/utils/iso4217.js
```

### Workflow de feature

```bash
git checkout develop && git pull
git checkout -b feature/<slug>
# trabalhe — hook block-direct-commit te impede de commitar em develop
# trabalhe — hook pre-push-gate roda build+test+smoke antes do push
git push -u origin feature/<slug>
# abre PR → develop (default branch já é develop, vai automático)
```

### Workflow de release

```bash
git checkout develop && git pull
git checkout -b release/1.0.0
# bump version em package.json + CHANGELOG.md
git push -u origin release/1.0.0
# PR → main
# Após merge em main: tag annotated vX.Y.Z + back-merge main → develop
```

---

## 10. Skills disponíveis neste repo

Em `.claude/skills/`:

| Skill | Cobre |
|---|---|
| `cielo-mpi-3ds` | Doc oficial Cielo/Braspag MPI 3DS 2.0 (URLs, classes `bpmpi_*`, callbacks, ECI, return codes). Dispara automaticamente ao tocar `adapters/mpi/` ou mencionar 3DS/MPI/Braspag |
| `project-overview` | **Esta skill** — entendimento geral do projeto |

Sempre que for trabalhar em `adapters/mpi/`, **consultar `cielo-mpi-3ds` antes** — é a fonte de verdade externa.

---

## 11. O que NÃO fazer

- ❌ **Não adicionar deps runtime npm.** Zero deps é selling point.
- ❌ **Não manter script MPI no DOM entre auths.** Quebra single-shot (ver § 5).
- ❌ **Não paralelizar `authenticate()` sem a fila** (`utils/auth-queue.js`, a portar Fase 1).
- ❌ **Não publicar `.d.ts`** — decisão de produto (rewrite é JS puro).
- ❌ **Não refatorar o as-is.** Está congelado.
- ❌ **Não editar `src/utils/iso4217.js` à mão** — saída de `scripts/generate-iso4217.mjs`.
- ❌ **Não expor `__configure` / `__setAdapterFactory` / `__resetAdapterFactory`** — `@internal`.
- ❌ **Não cutover antes da homolog E2E verde** (Fase 5).
- ❌ **Não publicar npm na v1** — v1 é CDN-only por decisão. Mas **nada no código/build/package.json pode impedir publish futuro**.
- ❌ **Não criar pastas `controllers/`/`models/`/`repositories/`** — SDK browser não tem esse modelo.
- ❌ **Não commitar em `main`/`develop` direto** — hook `block-direct-commit` + branch protection do GitHub bloqueiam, mas a regra é cultural antes.

---

## 12. Docs canônicas

### Neste repo (`checkout-3ds-starkbank`)
- `README.md` — público + visão geral arquitetura.
- `CLAUDE.md` — invariantes pra Claude Code (MPI, escopo v1 CDN-only).
- `CONTRIBUTING.md` — gitflow, convenção PR, setup, versionamento.
- `.claude/skills/project-overview/SKILL.md` — **esta skill**.
- `.claude/skills/cielo-mpi-3ds/SKILL.md` — doc Cielo consolidada.
- `.claude/hooks/*.sh` — scripts dos hooks (gitflow guard, pre-push gate, MPI reminder).

### No as-is (`starkbank-checkout`)
- `CLAUDE.md` — instruções de alto nível.
- `docs/PLANO-REFATORACAO.md` — estratégia + fases + critérios de done.
- `docs/PLANO-ARQUITETURA-V2.md` — estrutura de pastas-alvo (esta árvore).
- `docs/passos/0N-*.md` — trilho cronológico das decisões.
- `docs/DESENVOLVIMENTO.md` — guia interno (homolog, repos externos).
- `docs/INTEGRACAO.md` / `GUIA-INTEGRACAO.md` — público.
- `packages/checkout-3ds/src/` — **fonte de verdade do comportamento** até a Fase 5.

---

## 13. Ecossistema (homolog E2E — Fase 5)

| Repo | Porta local | Papel |
|---|---|---|
| `starkmerchantbackend` | `3001` | Mock backend (emite token 3DS + recebe `/api/checkout/complete`) |
| `ecomtester` | `5180` | Front demo Next.js; proxy same-origin `/api/checkout/*` → backend |

Homolog: rodar os dois + apontar `ecomtester` pra `npm link` ou tarball do repo em desenvolvimento. Cartões de teste sandbox: ver doc Cielo na skill `cielo-mpi-3ds`.

---

## 14. Heurísticas — onde mexer

| Cenário | Onde |
|---|---|
| Bug crítico em produção v1 | `starkbank-checkout`, branch `hotfix/<slug>` (não tocar aqui) |
| Adicionar campo no `AuthenticateInput` | Este repo, Fase 1 ou 2, `feature/<slug>` |
| Refactor de cleanup MPI | Este repo, Fase 3, `feature/fase3-<slug>` (não tocar no as-is) |
| Mudar README pro merchant | As-is enquanto v1 é produção; este repo após cutover |
| Adicionar CI | Não definido ainda — `docs/passos/99-ci-adiado.md` no as-is tem modelo |

---

## 15. Checklist mental ao começar uma sessão neste repo

1. **`git status` + `git branch --show-current`** — onde estou, working tree limpo?
2. **`git fetch && git status`** — sincronizado com remote?
3. Se vou tocar `adapters/mpi/`: **ler skill `cielo-mpi-3ds` primeiro**.
4. Se vou criar branch: parte de `develop` atualizada (hook bloqueia commit em develop, mas branch precisa partir dela).
5. Antes de push: `npm run build && npm test && npm run test:smoke` (hook `pre-push-gate` faz isso, mas vale rodar manual primeiro).
6. PR → `develop` (não `main`).

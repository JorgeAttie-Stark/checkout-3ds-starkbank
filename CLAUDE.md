# CLAUDE.md — `@starkbank/checkout-3ds` (rewrite v2)

Instruções operacionais para Claude Code trabalhando neste repo.
Para visão geral, ver [`README.md`](./README.md). Para o plano de migração, ver [`PLANO-ARQUITETURA-V2.md`](./PLANO-ARQUITETURA-V2.md).

---

## Stack

- **Linguagem:** JavaScript puro (ES modules). **Sem TypeScript, sem `.d.ts`.**
- **Runtime alvo:** browser (ES2020+).
- **Runtime deps:** **zero**. Único externo é o script Braspag MPI (carregado via CDN em runtime).
- **Build:** `esbuild` direto via `build.config.mjs` (ESM + CJS + IIFE).
- **Testes:** `vitest` + `jsdom`.
- **Node de dev:** 20 (`.nvmrc`).

## Escopo v1 — CDN-only

- **Distribuição oficial v1: CDN** (`dist/checkout-3ds.min.js` → `window.Stark3DS`).
- **npm não publica na v1.** ESM + CJS continuam sendo gerados pelo build e `package.json` mantém `exports`/`main`/`module` — para **não fechar** a porta de uma publicação npm futura.
- Regra: **nada no código, build ou package.json pode impedir o uso via npm depois.** Se for tirar algo "porque é CDN-only", parar e revalidar — provavelmente está fechando a porta errada.
- Testes prioritários: `npm run test:smoke` (valida o bundle CDN). `npm run test` (unit) continua obrigatório.

---

## Invariante crítico — MPI cleanup

> O script Braspag MPI é **single-session**.
> Se o `<script>` ou o iframe ficar pendurado no DOM após `authenticate()` (sucesso, falha ou timeout), a próxima chamada **trava silenciosamente** — sem erro, sem timeout útil.

### Onde o invariante mora

| Arquivo                                       | Responsabilidade                                          |
| --------------------------------------------- | --------------------------------------------------------- |
| `src/adapters/mpi/script-loader.js`           | `clearScriptLoadState()` — remove `<script>` + reseta promise cache |
| `src/adapters/mpi/browser-adapter.js`         | `cleanup()` — destrói iframe + chama `clearScriptLoadState` em **todo** settle path |

### Regras

1. **Todo settle path** (resolve, reject, timeout) em `browser-adapter.js` **deve** passar por `cleanup()`.
2. `cleanup()` é idempotente — pode ser chamado N vezes sem erro.
3. Existe **teste canary obrigatório** em `tests/adapters/mpi/browser-adapter.test.js`: disparar `authenticate()` duas vezes na mesma página e checar que a segunda completa.
4. **Nunca remover o canary.** Se quebrar, parar e investigar — não comentar.

### PRs que tocam `adapters/mpi/*`

Checklist obrigatório no corpo da PR:

- [ ] `cleanup()` é chamado em sucesso?
- [ ] `cleanup()` é chamado em falha?
- [ ] `cleanup()` é chamado em timeout?
- [ ] Canary `tests/adapters/mpi/browser-adapter.test.js` passa?

---

## Estrutura — qual pasta é qual

Resumo (detalhe completo no [README.md](./README.md#estrutura)):

| Pasta              | Pergunta que responde            | Pode ter DOM/IO? |
| ------------------ | -------------------------------- | ---------------- |
| `src/api/`         | O que o integrador importa?      | Não (só re-exports) |
| `src/services/`    | Qual caso de uso?                | Orquestra; não toca DOM MPI |
| `src/validation/`  | O input é válido?                | Não |
| `src/config/`      | Como resolvemos ambiente?        | Não |
| `src/adapters/mpi/`| Com quem falamos por fora?       | **Sim — único lugar com DOM MPI / Braspag** |
| `src/utils/`       | Helpers puros / infra genérica?  | Sem DOM MPI (fila/timeout são DOM-agnostic) |
| `src/core/`        | Fundação compartilhada           | Não |
| `src/testing/`     | Doubles de teste                 | Não publicar |

### O que NÃO fazer

- ❌ Colocar DOM MPI em `utils/` — fica em `adapters/mpi/`.
- ❌ Colocar chamada a Braspag em `services/` — services **orquestra**, adapter **executa**.
- ❌ Paralelizar `authenticate()` sem passar por `utils/auth-queue.js`.
- ❌ Manter `<script>` MPI no DOM entre auths.
- ❌ Portar `resolve-access-token.ts` (não vai pro v2) ou `stark-payment-fields.ts` (código morto).
- ❌ Criar pastas `controllers/`, `models/`, `repositories/` — SDK browser não tem esse modelo.

---

## Contrato público — preservar 100%

Não mudar nem renomear:

```
Stark3DS.authenticate
Stark3DS.isLiabilityShiftToIssuer
isAuthenticated
toChallengeResult
isLiabilityShiftToIssuer
Stark3DSError
Stark3DSValidationError
Stark3DSAuthenticateTimeoutError
```

CDN (`api/cdn.js`) também expõe aliases `Error`, `ValidationError`, `AuthenticateTimeoutError`.

**Nunca expor publicamente:** `__configure`, `__setAdapterFactory`, `__resetAdapterFactory`, qualquer coisa de `adapters/mpi/`.

---

## Governança de PR

- 1 fase **ou** 1 subpasta `adapters/mpi/*` por PR.
- Nunca refatorar `services/authenticate.js` + `adapters/mpi/*` na mesma PR.
- PRs MPI: checklist canary cleanup explícito (acima).
- `main` sempre deployável.

---

## Antes de declarar tarefa pronta

- `npm run build` verde.
- `npm run test` verde.
- `npm run test:smoke` verde (especialmente após mexer no bundle CDN).
- Para mudanças em `adapters/mpi/*`: validar que segundo `authenticate()` na mesma página ainda funciona.

---

## Fonte de verdade do comportamento

Quando em dúvida sobre **o que** o código deve fazer (não como estruturar): ler o as-is em `~/starkbank-checkout/packages/checkout-3ds/src/`. A paridade comportamental é critério de aceite até a Fase 5 (cutover).

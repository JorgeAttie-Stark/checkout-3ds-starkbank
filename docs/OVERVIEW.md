# Sobre o projeto

`@starkbank/checkout-3ds` é o SDK browser que o time Stark Bank disponibiliza pra integradores autenticarem cartões via 3DS 2.0 na hora do checkout.

> **Cliente / integrador:** ver [`../README.md`](../README.md).
> **Mapa técnico detalhado:** [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## O que ele faz, em uma linha

Recebe `accessToken + order + card` no frontend do merchant, executa o fluxo 3DS contra um gateway externo, devolve um `challenge` que o backend Stark consome pra finalizar a cobrança.

```
input do merchant → 3DS authenticate → challenge pronto pro backend Stark
```

## Por que existe (contexto interno)

Antes deste SDK, cada integrador (e cada app interno) reimplementava o fluxo 3DS na mão — script externo + iframe + callbacks + cleanup. O resultado eram bugs sutis recorrentes:

- Script do gateway ficando pendurado no DOM e travando a segunda tentativa de pagamento.
- Globais do provider conflitando com scripts do merchant.
- Sem padrão de timeout / retry / validação de input.
- Mensagens de erro inconsistentes entre integrações.

Este SDK encapsula tudo isso num pacote único, com contrato estável e testes que travam o comportamento.

## Quem usa

- Apps internos Stark (web checkout, formulários institucionais).
- Integradores externos (lojistas) via CDN.
- Times de QA via página de validação local (não distribuída).

## Stack e regras de operação

- **JavaScript puro (ES2020+)** — sem TypeScript.
- **Zero deps em runtime.** A única dependência externa é o `<script>` do gateway 3DS, carregado dinamicamente.
- **Distribuição:** CDN (IIFE). Build também gera ESM + CJS pra release npm futura.
- **Node 20** em dev (`.nvmrc`).
- **Testes:** vitest + jsdom (unit) + smoke contra o bundle real.

## Como começar (dev)

```bash
nvm use            # Node 20
npm install
npm test           # vitest unit
npm run build      # ESM + CJS + IIFE em dist/
npm run test:smoke # valida o bundle CDN
```

Antes da primeira PR: ler [`ARCHITECTURE.md`](./ARCHITECTURE.md) e [`../CLAUDE.md`](../CLAUDE.md). O segundo documenta o invariante crítico do gateway 3DS — única regra que se quebrada gera bug em produção sem mensagem útil.

## Princípios

1. **Contrato público é sagrado.** Mudar `Stark3DS.authenticate`, helpers, ou classes de erro = major version. Mensagens de erro também — merchants podem ter teste em cima.
2. **Vocabulário por responsabilidade, não por tipo.** Pastas respondem a perguntas (`O que o integrador importa?`, `Qual caso de uso?`, `Com quem falamos por fora?`). Sem `controllers/`, `models/`, `repositories/`.
3. **Direção de dependência fixa.** `core/` é folha. `utils/` depende só de `core/`. `adapters/` não importa de `services/`. Viola = quebra arquitetura.
4. **Zero deps em runtime.** Tudo que entra precisa de justificativa forte.
5. **Cleanup é invariante.** Todo settle path do adapter (sucesso, falha, timeout) passa por `cleanup()`. Tem teste canary que prova. Nunca remover.

## Pasta `docs/` é interna

Esta pasta **não vai no tarball npm** — não está listada em `files` no `package.json`. Vive só no repositório, pra apoiar o time de manutenção. Quem consome o SDK não vê isso.

| Documento | Pra que serve |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Estrutura, responsabilidade de cada arquivo, pipeline de runtime, invariantes, governança de PR |

Pra adicionar doc novo: nome descritivo em `MAIÚSCULAS.md`, markdown, sem refs a códigos de cliente.

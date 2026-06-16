<div align="center">

# `@starkbank/checkout-3ds`

**Stark Bank browser SDK — 3DS card authentication at checkout.**
JavaScript puro · zero runtime deps · drop-in via CDN.

[![runtime](https://img.shields.io/badge/runtime-browser-blue.svg)]()
[![deps](https://img.shields.io/badge/deps-0-success.svg)]()
[![license](https://img.shields.io/badge/license-Proprietary-lightgrey.svg)](./LICENSE)

</div>

---

SDK de autenticação 3DS 2.0 no checkout. Recebe os dados do cartão e do pedido, autentica o portador e devolve um `challenge` pronto pro backend Stark finalizar a cobrança.

```
input do merchant → 3DS authenticate → challenge pronto pro backend Stark
```

---

## Instalação

### CDN (recomendado)

```html
<script src="https://cdn.starkbank.com/checkout-3ds/v1/checkout-3ds.min.js"></script>
<script>
  // window.Stark3DS já está pronto
</script>
```

### Content Security Policy

O SDK carrega um script externo de runtime 3DS em tempo de execução. Permita:

```
script-src 'self' https://mpisandbox.braspag.com.br https://mpi.braspag.com.br;
frame-src 'self';
```

O SDK isola o runtime 3DS em iframe sandbox por padrão — `frame-src 'self'` só se a loja usar CSP.

> Os domínios acima são fixos e pertencem ao gateway 3DS usado pelo SDK. Não dependem do merchant.

---

## Uso mínimo

```js
const output = await Stark3DS.authenticate({
  accessToken: "JWT-DO-BACKEND",
  order: {
    number: "order-001",
    amount: 10000,                // em centavos
    currency: "BRL",              // ISO 4217 alpha
    installments: 1,
    paymentMethod: "credit",      // "credit" | "debit"
  },
  card: {
    number: "4111111111111111",
    expirationMonth: "12",
    expirationYear: "2030",
  },
});

if (Stark3DS.isAuthenticated(output)) {
  const challenge = Stark3DS.toChallengeResult(output);
  // POST challenge pro seu backend pra finalizar a compra
}
```

Guia detalhado de uso, configuração avançada (timeout, debug, isolation) e migração: [`docs/USAGE.md`](./docs/USAGE.md).

---

## API pública

| Função | Descrição |
|---|---|
| `Stark3DS.authenticate(input)` | Faz a autenticação 3DS. Retorna `Promise<AuthenticateOutput>`. |
| `Stark3DS.isAuthenticated(output)` | `true` se 3DS autenticou e há `challenge` pronto. |
| `Stark3DS.toChallengeResult(output)` | Extrai o `challenge`. Lança se não autenticou. |
| `Stark3DS.isLiabilityShiftToIssuer(eci)` | `true` se o ECI gera liability shift pro issuer. |

### Classes de erro

- `Stark3DS.Error` — base de todos os erros do SDK
- `Stark3DS.ValidationError` — input inválido
- `Stark3DS.AuthenticateTimeoutError` — 3DS não respondeu no tempo

---

## Scripts

```bash
npm run build              # ESM + CJS + IIFE em dist/
npm test                   # vitest (unit)
npm run test:smoke         # smoke do bundle CDN
npm run generate:iso4217   # regenera src/utils/iso4217.js
```

---

## Referências

| Documento | Conteúdo |
|---|---|
| [`docs/USAGE.md`](./docs/USAGE.md) | Guia completo de uso: API, configuração, migração, FAQ |
| [`CHANGELOG.md`](./CHANGELOG.md) | Histórico de releases |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Gitflow, convenção de PR, setup |
| [`LICENSE`](./LICENSE) | Termos de uso |

---

<sub>© Stark Bank — proprietary.</sub>

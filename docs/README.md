# docs/

Documentação interna pra mantenedores do `@starkbank/checkout-3ds`.

**Cliente / integrador:** ver [`../README.md`](../README.md) na raiz.

Esta pasta **não vai no tarball npm** (não está listada no campo `files` do `package.json`). Vive apenas no repositório, pra apoiar o trabalho do time de manutenção.

Conteúdo:

| Documento | Pra que serve |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Guia de arquitetura: pastas, responsabilidade de cada arquivo, pipeline de runtime, invariantes, governança de PR |

Pra adicionar um doc novo aqui: usar nome descritivo (kebab-case ou `MAIÚSCULAS.md` se for raiz-style), markdown, sem refs a códigos de cliente.

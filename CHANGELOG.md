# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- SDK browser pra autenticação 3DS 2.0 no checkout
- API pública: `Stark3DS.authenticate`, `Stark3DS.isAuthenticated`, `Stark3DS.toChallengeResult`, `Stark3DS.isLiabilityShiftToIssuer`
- Distribuição via CDN (IIFE) — `window.Stark3DS`
- Build dual ESM + CJS (npm em release futura)
- Runtime isolado em iframe sandbox por padrão — opt-out via `isolateRuntime: false`
- Timeout interno com `Stark3DSAuthenticateTimeoutError` (default 120s, configurável)
- Cleanup automático após cada `authenticate()` (sucesso, falha ou timeout)
- Zero runtime deps

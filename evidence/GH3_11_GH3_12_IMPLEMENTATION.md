# GH3.11 / GH3.12 implementation evidence

Date: 2026-08-20
Repository: `korzh260609-beep/garya-bot`
Branch: `dev/sg2.1-semantic`

## GH3.11 closure

- Implementation: `src/githubDevelopment/githubSecurityControlPlane.js`
- Tests: `tests/githubSecurityControlPlane.test.js`
- Exact implementation HEAD: `8c34eb87a3c3d5f55e85818ead2ae13e3387c668`
- SG 2.1 CI: #8591 — `SUCCESS`
- Result: **CLOSED / CI-VERIFIED**.

## GH3.12 implementation

- Implementation: `src/githubDevelopment/githubCrossTransportAcceptance.js`
- Tests: `tests/githubCrossTransportAcceptance.test.js`
- Exact implementation HEAD: `11bca7313b84265f093e615121707165c55d07a5`
- SG 2.1 CI: #8593 — `SUCCESS`
- Result: **IMPLEMENTED / CI-VERIFIED / LIVE ACCEPTANCE PENDING**.

The GH3.12 acceptance runner requires evidence for qualified public discovery, unauthorized private-repository denial, one durable actor/project/task across two different transports, exact baseline/CI/docs verification, atomic multi-file commit plus PR, failed exact-head CI with actionable failure, derived repair plus green exact-head CI, restart reconciliation without duplicate external actions, separately gated protected operations, secret safety and PDK4/PM3 lifecycle qualification.

The validator fails closed on another-SHA CI, missing private denial, same-transport continuation, restart duplicates, secret-shaped evidence, unsafe protected authorization or false PM3/deployed/live promotion.

## Remaining closure gate

GH3.12 is not formally CLOSED by deterministic tests alone. Closure still requires the real authorized GitHub/live SG acceptance boundary defined by the canonical roadmap/workflow, including continuation through two real authorized SG transport/API surfaces. The acceptance code deliberately cannot manufacture or self-assert that live evidence.

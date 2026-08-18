# SG 2.1 — Telegram Membership & Subscription Program

Status authority: this document plus `CURRENT_STATUS.md`.
Program code: **TMA2.1**.
Scope: access to Telegram workspaces through join requests now, with a durable path to paid monthly subscriptions later.

## Product boundary

Telegram cannot intercept a direct add performed by an administrator: that user becomes a member immediately. Managed access therefore requires a private group and a bot-created invite link with `creates_join_request=true`. SG processes only the resulting `chat_join_request`.

The current production mode is **free approval**. Paid access is not enabled until the owner explicitly approves plan price, currency, duration, grace period and refund policy.

## Stages

| Stage | Deliverable | Status |
|---|---|---|
| TMA2.1.1 | Telegram join-request contract, bot permissions and fail-closed workspace resolution | Implemented; CI pending |
| TMA2.1.2 | Durable PostgreSQL membership state and migration | Implemented; CI pending |
| TMA2.1.3 | Free join-request gate: identify, persist, approve and activate each user independently | Implemented; CI pending |
| TMA2.1.4 | Admin command/UI to create and rotate a join-request invite link; show “Подписаться/Присоединиться” | Planned |
| TMA2.1.5 | Membership reconciliation for leave, kick, ban, rejoin and group migration events | Planned |
| TMA2.1.6 | Subscription plans: price, Telegram Stars currency, billing period, grace and exemptions | Blocked on owner product choices |
| TMA2.1.7 | Payment lifecycle: invoice, pre-checkout validation, successful-payment idempotency and renewal | Planned |
| TMA2.1.8 | Expiry scheduler and reminders using existing SG durable scheduling/worker seams | Planned |
| TMA2.1.9 | Expired-member enforcement with fresh bot-rights check, removal and durable audit | Planned |
| TMA2.1.10 | Refunds, disputes, duplicate events and recovery/restart continuity | Planned |
| TMA2.1.11 | Owner/admin controls, membership list, manual grant/revoke and diagnostics | Planned |
| TMA2.1.12 | Security regression, exact-head CI, deployment and two-account live acceptance | Planned |

## Current implementation contract

- Webhook registration requests `chat_join_request` and `chat_member` updates.
- Every Telegram update remains protected by the existing durable update claim/deduplication.
- A request is resolved against the canonical Telegram workspace registry.
- Unknown workspaces are declined; SG never creates an access grant from an unregistered chat.
- The Telegram identity is resolved through the existing production Identity boundary.
- Pending and active states are persisted per `(workspace_id, telegram_user_id)`; one participant cannot complete or close another participant's membership flow.
- Telegram approval failure records a declined state and never reports active membership.
- Payment secrets and provider calls are not introduced in the free stage.

## Live prerequisites for TMA2.1.1–TMA2.1.3

1. The group is private.
2. The bot is administrator with permission to invite users.
3. Users enter through a join-request invite link, not through Telegram's direct “Add member” action.
4. The deployment has run migration `911_telegram_membership_access.sql`.
5. The webhook is re-registered after deployment so its allowed updates include `chat_join_request`.

## Closure rules

No stage is CLOSED without implementation evidence, focused regression tests, exact-head SG 2.1 CI and the live evidence required by that stage. Payment and automated removal cannot be called implemented from schema placeholders or roadmap text alone.

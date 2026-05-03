# users — SG 2.0 Users Module

> AGENT NOTE:
> This file defines the SG 2.0 users module boundary.
> Read it before adding user profiles, roles, plans, access status, global_user_id, or identity links.
> Do not tie SG identity permanently to Telegram ID or mix user contexts without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`users` manages identity and user profile boundaries.

---

## Owns

- user records;
- identity links;
- future global_user_id;
- role/plan references;
- access status;
- user-level settings.

---

## Must not own

- permission policy implementation;
- memory content;
- transport handlers;
- billing calculations;
- AI calls.

---

## Hard rule

Telegram ID may be used early, but architecture must remain ready for global user identity.

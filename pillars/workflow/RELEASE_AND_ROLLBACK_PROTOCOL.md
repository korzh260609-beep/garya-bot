# RELEASE AND ROLLBACK PROTOCOL

Before release:
1. Verify acceptance criteria.
2. Run relevant automated tests.
3. Verify migrations and backward compatibility where applicable.
4. Verify secrets and environment configuration.
5. Verify protected-action gates.
6. Verify observability and alerts.
7. Define rollback or disable path.
8. Release through the intended environment process.
9. Record factual release evidence outside architecture and roadmap.

No release may redefine architecture by convenience.

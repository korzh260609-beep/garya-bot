# Render workflow

13. Before changing `Dockerfile.render` to a new image tag, verify that the exact image exists and record its immutable digest.
14. Render deploy, restart, rollback, and environment changes each require explicit authorization. Use `sg_render` for Render operations. After an authorized deploy, verify Live status, deploy ID, source SHA, `image_commit`, `/health`, gateway, Telegram connection and probe, model API, `sg_render`, required workspace files, and RSS.

#!/bin/sh
set -eu

exec node /app/openclaw.mjs gateway --allow-unconfigured --bind lan

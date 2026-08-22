#!/bin/sh
set -eu

prisma db push --accept-data-loss --skip-generate
node scripts/migrate-merchants.mjs
exec node server.js

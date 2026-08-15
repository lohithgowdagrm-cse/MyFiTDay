#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/frontend"
npm install
[ -f .env ] || cp .env.example .env
npm run dev

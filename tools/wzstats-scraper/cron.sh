#!/usr/bin/env bash
# Cron diario: scrape completo de wzstats.gg
# Cron sugerido (5am):
#   0 5 * * *  /opt/camibot/tools/wzstats-scraper/cron.sh

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
mkdir -p logs
LOG="logs/scraper-$(date +%Y%m%d).log"

{
  echo "═══ $(date -Iseconds) ═══"
  /usr/bin/node scraper.mjs --browser
  echo "═══ fin $(date -Iseconds) ═══"
  echo ""
} >> "$LOG" 2>&1

# Rotación: borrar logs > 14 días
find logs -name 'scraper-*.log' -mtime +14 -delete 2>/dev/null || true

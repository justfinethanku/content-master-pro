#!/bin/bash
#
# Daily Changelog Ingestion Script
#
# This script runs the changelog ingestion and logs output.
# Designed to be run by launchd at 6am daily.
#
# Usage:
#   ./scripts/daily-ingest.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/ingest-$(date +%Y-%m-%d).log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo "========================================" >> "$LOG_FILE"
echo "Changelog Ingestion - $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Change to project directory
cd "$PROJECT_DIR"

# Run ingestion script
npx tsx scripts/ingest-changelogs.ts >> "$LOG_FILE" 2>&1

echo "" >> "$LOG_FILE"
echo "Completed at $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Clean up old logs (keep last 30 days)
find "$LOG_DIR" -name "ingest-*.log" -mtime +30 -delete 2>/dev/null || true

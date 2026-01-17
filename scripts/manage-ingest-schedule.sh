#!/bin/bash
#
# Manage the daily changelog ingestion LaunchAgent
#
# Usage:
#   ./scripts/manage-ingest-schedule.sh install   # Install and enable
#   ./scripts/manage-ingest-schedule.sh uninstall # Remove LaunchAgent
#   ./scripts/manage-ingest-schedule.sh status    # Check status
#   ./scripts/manage-ingest-schedule.sh run       # Run ingestion now
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.contentmasterpro.ingest"
PLIST_SOURCE="$SCRIPT_DIR/$PLIST_NAME.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

case "$1" in
  install)
    echo "Installing changelog ingestion LaunchAgent..."

    # Create LaunchAgents directory if it doesn't exist
    mkdir -p "$HOME/Library/LaunchAgents"

    # Copy plist to LaunchAgents
    cp "$PLIST_SOURCE" "$PLIST_DEST"

    # Load the agent
    launchctl load "$PLIST_DEST"

    echo "✅ Installed! Ingestion will run daily at 6:00 AM"
    echo ""
    echo "To run immediately: ./scripts/manage-ingest-schedule.sh run"
    echo "To check status:    ./scripts/manage-ingest-schedule.sh status"
    ;;

  uninstall)
    echo "Uninstalling changelog ingestion LaunchAgent..."

    # Unload if loaded
    launchctl unload "$PLIST_DEST" 2>/dev/null

    # Remove plist
    rm -f "$PLIST_DEST"

    echo "✅ Uninstalled"
    ;;

  status)
    echo "LaunchAgent Status:"
    echo ""

    if [ -f "$PLIST_DEST" ]; then
      echo "Plist: ✅ Installed at $PLIST_DEST"
    else
      echo "Plist: ❌ Not installed"
      exit 1
    fi

    if launchctl list | grep -q "$PLIST_NAME"; then
      echo "Agent: ✅ Loaded"
      launchctl list "$PLIST_NAME"
    else
      echo "Agent: ❌ Not loaded"
    fi
    ;;

  run)
    echo "Running changelog ingestion now..."
    npx tsx "$SCRIPT_DIR/ingest-changelogs.ts"
    ;;

  *)
    echo "Usage: $0 {install|uninstall|status|run}"
    echo ""
    echo "Commands:"
    echo "  install   - Install and enable the LaunchAgent"
    echo "  uninstall - Remove the LaunchAgent"
    echo "  status    - Check if the agent is installed and loaded"
    echo "  run       - Run ingestion immediately"
    exit 1
    ;;
esac

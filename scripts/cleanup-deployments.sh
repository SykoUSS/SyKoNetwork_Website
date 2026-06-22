#!/usr/bin/env bash
#
# cleanup-deployments.sh
# Deletes all GitHub deployments (and their statuses) for a given repo.
#
# Usage:
#   ./cleanup-deployments.sh [OWNER/REPO]
#
# Example:
#   ./cleanup-deployments.sh SyKoSoFi/sykonetwork-website
#
# Prerequisites:
#   - gh CLI authenticated (gh auth login)
#   - jq installed
#
# Notes:
#   - GitHub only allows deleting INACTIVE deployments.
#     If a deployment is "active", you must first mark it inactive by creating
#     a new deployment to the same environment (which auto-inactivates the old one)
#     or by setting its status to "inactive" via the API.
#   - This script handles that: it first marks active deployments as inactive,
#     then deletes them.
#

set -euo pipefail

REPO="${1:?Usage: $0 OWNER/REPO}"

echo "🔍 Fetching deployments for $REPO ..."

# Fetch all deployment IDs
DEPLOYMENTS=$(gh api "repos/$REPO/deployments?per_page=100" --paginate -q '.[].id')

if [ -z "$DEPLOYMENTS" ]; then
  echo "✅ No deployments found. Nothing to clean up!"
  exit 0
fi

TOTAL=$(echo "$DEPLOYMENTS" | wc -l)
echo "📋 Found $TOTAL deployment(s). Starting cleanup..."

COUNT=0
FAILED=0

for DEPLOY_ID in $DEPLOYMENTS; do
  COUNT=$((COUNT + 1))

  # First, try to mark the deployment as inactive by creating an "inactive" status
  # This is needed because GitHub won't let you delete an "active" deployment
  echo "  [$COUNT/$TOTAL] Marking deployment #$DEPLOY_ID as inactive..."
  gh api "repos/$REPO/deployments/$DEPLOY_ID/statuses" \
    -f state="inactive" \
    -f description="Marked inactive for cleanup" \
    --silent 2>/dev/null || true

  # Now delete the deployment
  echo "  [$COUNT/$TOTAL] Deleting deployment #$DEPLOY_ID..."
  if gh api -X DELETE "repos/$REPO/deployments/$DEPLOY_ID" --silent 2>/dev/null; then
    echo "  ✅ Deleted deployment #$DEPLOY_ID"
  else
    echo "  ⚠️  Could not delete deployment #$DEPLOY_ID (may require manual review)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Cleanup complete!"
echo "   Deleted: $((TOTAL - FAILED))/$TOTAL"
echo "   Failed:  $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "💡 Tip: Some deployments may fail to delete if they are still referenced"
  echo "   by an active environment. Try running this script again, or delete"
  echo "   the environment first via GitHub Settings > Environments."
fi
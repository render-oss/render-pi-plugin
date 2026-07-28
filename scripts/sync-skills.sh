#!/usr/bin/env bash
#
# Vendor Render's OSS skills into ./skills.
#
# Skills are the source of truth in render-oss/skills — we do NOT fork them.
# This script pulls a *pinned* commit for reproducibility; bump PIN deliberately
# in its own reviewable PR. Do not edit vendored files by hand.
#
set -euo pipefail

REPO="https://github.com/render-oss/skills.git"
# render-oss/skills @ main
PIN="4e4a00a51a99aa772793b1a2ab3abe0e214c88ef"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/skills"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Cloning render-oss/skills @ ${PIN} ..."
git clone --quiet --filter=blob:none "$REPO" "$TMP/repo"
git -C "$TMP/repo" checkout --quiet "$PIN"

echo "Refreshing ${DEST} ..."
rm -rf "$DEST"
mkdir -p "$DEST"

# Copy every render-* skill directory (SKILL.md + references/ + assets/).
cp -R "$TMP/repo/skills/"render-* "$DEST/"

# Record provenance so we (and tests) can see exactly what is vendored.
cat > "$DEST/.sync-source" <<EOF
source: render-oss/skills
commit: ${PIN}
synced: $(date -u +%Y-%m-%dT%H:%M:%SZ)
note: vendored by scripts/sync-skills.sh — do not edit by hand; re-run \`npm run sync-skills\`.
EOF

count="$(find "$DEST" -name SKILL.md | wc -l | tr -d ' ')"
echo "Vendored ${count} skills into skills/."

#!/usr/bin/env bash
# scripts/rebrand.sh — one-click replace Rebuild-Z → YOUR_ORG (+ optional product rename)
# Usage:
#   ./scripts/rebrand.sh [NEW_ORG] [NEW_NAME]
#   ./scripts/rebrand.sh YOUR_ORG applicant-review        # default (no-op example)
#   ./scripts/rebrand.sh my-org my-product
#   ./scripts/rebrand.sh                                  # interactive
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_ORG="Rebuild-Z"
OLD_NAME="applicant-review"
OLD_ORG_PLACEHOLDER="YOUR_ORG"

NEW_ORG="${1:-}"
NEW_NAME="${2:-}"

if [ -z "$NEW_ORG" ]; then
  read -rp "New GitHub org/user [YOUR_ORG]: " NEW_ORG
  NEW_ORG="${NEW_ORG:-YOUR_ORG}"
fi
if [ -z "$NEW_NAME" ]; then
  read -rp "New repo/product name [applicant-review] (leave empty to keep): " NEW_NAME
  NEW_NAME="${NEW_NAME:-$OLD_NAME}"
fi

echo "Rebranding in $ROOT"
echo "  Org:  $OLD_ORG / $OLD_ORG_PLACEHOLDER -> $NEW_ORG"
echo "  Name: $OLD_NAME -> $NEW_NAME"
echo ""

# Files to patch (if exist)
FILES=(
  "package.json"
  "README.md"
  "CONTRIBUTING.md"
  "LICENSE"
  ".github/workflows/ci.yml"
  ".github/workflows/release.yml"
  ".github/workflows/dco.yml"
  ".github/PULL_REQUEST_TEMPLATE.md"
  ".github/ISSUE_TEMPLATE/bug_report.yml"
  ".github/ISSUE_TEMPLATE/feature_request.yml"
  ".github/ISSUE_TEMPLATE/config_example.yml"
  "SECURITY.md"
  "CODE_OF_CONDUCT.md"
  "SUPPORT.md"
  "TRADEMARK.md"
  "GOVERNANCE.md"
  "CHANGELOG.md"
  "PRICING.md"
  "NOTICE"
  "docs/PLAN_COMMERCIALIZATION.md"
)

# Helper: sed in place (GNU/BSD compatible)
sed_inplace() {
  local pattern="$1" file="$2"
  if sed --version >/dev/null 2>&1; then
    sed -i -e "$pattern" "$file"
  else
    sed -i '' -e "$pattern" "$file"
  fi
}

count=0
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    # Replace Rebuild-Z (legacy hardcoded) and YOUR_ORG placeholder
    sed_inplace "s|${OLD_ORG}|${NEW_ORG}|g" "$f"
    sed_inplace "s|${OLD_ORG_PLACEHOLDER}|${NEW_ORG}|g" "$f"
    # Optionally replace repo name if different
    if [ "$NEW_NAME" != "$OLD_NAME" ]; then
      sed_inplace "s|${OLD_NAME}|${NEW_NAME}|g" "$f"
    fi
    echo "  patched $f"
    count=$((count+1))
  fi
done

# Also patch any other md/json/yml that still contains the old strings
# (excluding node_modules/dist/.git/coverage)
echo ""
echo "Scanning remaining files for leftover placeholders..."
LEFTOVER=$(grep -r --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=coverage -l -e "$OLD_ORG" -e "YOUR_ORG.*applicant-review" . 2>/dev/null | head -n 20 || true)
if [ -n "$LEFTOVER" ]; then
  echo "  Remaining hits (review manually):"
  echo "$LEFTOVER" | sed 's/^/    /'
else
  echo "  No leftover hits."
fi

# Update package.json fields explicitly via node if available (more robust than sed)
if command -v node >/dev/null 2>&1 && [ -f "package.json" ]; then
  node --input-type=module <<EOF
import fs from 'fs';
const p = JSON.parse(fs.readFileSync('package.json','utf8'));
p.author = p.author && p.author.includes('Rebuild-Z') ? '${NEW_ORG}' : p.author;
if (p.homepage) p.homepage = p.homepage.replace(/github\.com\/[^/]+\//, 'github.com/${NEW_ORG}/').replace('${OLD_ORG}', '${NEW_ORG}').replace('${OLD_ORG_PLACEHOLDER}', '${NEW_ORG}');
if (p.repository && p.repository.url) p.repository.url = p.repository.url.replace(/github\.com\/[^/]+\//, 'github.com/${NEW_ORG}/').replace('${OLD_ORG}', '${NEW_ORG}').replace('${OLD_ORG_PLACEHOLDER}', '${NEW_ORG}');
if (p.bugs && p.bugs.url) p.bugs.url = p.bugs.url.replace(/github\.com\/[^/]+\//, 'github.com/${NEW_ORG}/').replace('${OLD_ORG}', '${NEW_ORG}').replace('${OLD_ORG_PLACEHOLDER}', '${NEW_ORG}');
if ('${NEW_NAME}' !== '${OLD_NAME}') {
  p.name = '${NEW_NAME}';
}
// Keep helpful TODO as _comment
if (!p._comment_rebrand) p._comment_rebrand = 'TODO: replace YOUR_ORG with your GitHub org/user; run ./scripts/rebrand.sh YOUR_ORG to automate';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
console.log('  package.json fields normalized via node');
EOF
fi

echo ""
echo "Done. Patched $count tracked files."
echo "Next steps:"
echo "  1) git diff --stat   # review"
echo "  2) git diff          # verify URLs"
echo "  3) npm run typecheck && npm run lint"
echo "  4) git add -A && git commit -s -m 'chore: rebrand to ${NEW_ORG}/${NEW_NAME}'"

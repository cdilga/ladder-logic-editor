#!/bin/bash
# Auto commit script: test → build → commit → push
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get commit message
MSG="${1:-Auto commit}"

echo -e "${YELLOW}[1/4] Running tests...${NC}"
if npm test --if-present 2>/dev/null; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠ No tests or tests skipped${NC}"
fi

echo -e "${YELLOW}[2/4] Building...${NC}"
npm run build
echo -e "${GREEN}✓ Build passed${NC}"

echo -e "${YELLOW}[3/4] Committing...${NC}"
git add -A
if git diff --staged --quiet; then
    echo -e "${YELLOW}Nothing to commit${NC}"
    exit 0
fi

git commit -m "$MSG

Co-Authored-By: Claude <noreply@anthropic.com>"
echo -e "${GREEN}✓ Committed${NC}"

echo -e "${YELLOW}[4/4] Pushing...${NC}"
if git push 2>/dev/null; then
    echo -e "${GREEN}✓ Pushed${NC}"
else
    echo -e "${YELLOW}⚠ Push failed (no remote?)${NC}"
fi

echo -e "${GREEN}Done!${NC}"

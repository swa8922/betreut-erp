#!/bin/bash
# github-setup.sh
# Erstellt GitHub Repo, pusht Code, verbindet mit Vercel
# Ausführen: bash github-setup.sh

GITHUB_TOKEN="pfattner"
GITHUB_USER="swa8922"
REPO_NAME="vbetreut-erp"
VERCEL_TOKEN="vcp_5xaVEp6FAAVjWXYUdXYW3VNbIFfxzbOKRrtn8O7q8BA5ztmk2z3EOnHt"
VERCEL_SCOPE="stefan-wagners-projects-488d50fb"

echo "🚀 VBetreut ERP — GitHub + Vercel Setup"
echo "========================================="

# 1. GitHub Repo erstellen (privat)
echo ""
echo "📁 Erstelle GitHub Repository..."
curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"VBetreut 24h-Betreuungsagentur ERP\",\"private\":true,\"auto_init\":false}" \
  | grep -E '"full_name"|"html_url"|"message"' | head -3

# 2. Git Remote setzen und pushen
echo ""
echo "📤 Code auf GitHub pushen..."
git init 2>/dev/null || true
git config user.email "stefan@vbetreut.at"
git config user.name "Stefan Wagner"
git branch -M main 2>/dev/null || true
git remote remove origin 2>/dev/null || true
git remote add origin "https://$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git"
git add -A
git commit -m "VBetreut ERP — Initial deployment" 2>/dev/null || true
git push -u origin main --force

echo ""
echo "✅ Code ist auf GitHub: https://github.com/$GITHUB_USER/$REPO_NAME"

# 3. Vercel mit GitHub verbinden und deployen
echo ""
echo "⚡ Deploye auf Vercel..."
npm install vercel 2>/dev/null
npx vercel --token "$VERCEL_TOKEN" --scope "$VERCEL_SCOPE" --yes --prod

echo ""
echo "🎉 Fertig! Die App läuft jetzt live."
echo "   GitHub: https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "   Nächste Updates: git push → Vercel deployed automatisch"

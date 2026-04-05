#!/bin/bash
echo "=== VBetreut CarePlus → GitHub betreut-erp ==="

cd "$(dirname "$0")"

# Remote setzen
git remote remove origin 2>/dev/null || true
git remote add origin "https://pfattner:margot@github.com/swa8922/betreut-erp.git"
git branch -M main

# Alle Änderungen committen falls vorhanden
git add -A
git diff --cached --quiet || git commit -m "VBetreut ERP — neueste Version"

# Force push (überschreibt alte Version)
git push origin main --force

echo ""
echo "✅ Fertig! Vercel sollte jetzt automatisch deployen."
echo "   → https://vercel.com/stefan-wagners-projects-488d50fb/vbetreut-erp"

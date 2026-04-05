#!/bin/bash
cd "$(dirname "$0")"

echo "Pushe VBetreut CarePlus auf GitHub..."

git remote remove origin 2>/dev/null || true
git remote add origin "https://pfattner:margot@github.com/swa8922/careplus.git"
git branch -M main

# Sicherstellen dass alle Änderungen committed sind
git add -A
git diff --cached --quiet || git commit -m "CarePlus ERP — Production ready"

git push origin main --force 2>&1
echo ""
echo "Fertig! Vercel startet jetzt automatisch den Build."

#!/bin/bash
echo "VBetreut CarePlus → GitHub"
echo "==========================="

# Repository erstellen
echo "Erstelle Repository swa8922/careplus..."
curl -s -X POST \
  -H "Authorization: token pfattner" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d '{"name":"careplus","private":true,"description":"VBetreut CarePlus ERP"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Erstellt:', d.get('html_url','Fehler:'+str(d.get('message',''))))" 2>/dev/null || true

# Pushen
git remote remove origin 2>/dev/null || true
git remote add origin "https://pfattner:margot@github.com/swa8922/careplus.git"
git branch -M main
git push -u origin main --force

echo ""
echo "Fertig! https://github.com/swa8922/careplus"
echo ""
echo "Jetzt auf vercel.com:"
echo "1. New Project → GitHub → swa8922/careplus"
echo "2. Environment Variables aus .env.local eintragen"
echo "3. Deploy"

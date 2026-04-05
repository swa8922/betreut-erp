@echo off
echo VBetreut CarePlus - Push zu GitHub betreut-erp
echo ================================================

git remote remove origin 2>nul
git remote add origin https://pfattner:margot@github.com/swa8922/betreut-erp.git
git branch -M main
git add -A
git commit -m "VBetreut ERP neueste Version" 2>nul
git push origin main --force

echo.
echo Fertig! Vercel startet automatisch den Build.
pause

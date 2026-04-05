@echo off
echo VBetreut ERP — Vercel Deployment
echo ==================================

REM Vercel lokal installieren (kein Admin / sudo noetig)
echo Installiere Vercel lokal...
call npm install vercel

REM Deployen mit Token — kein Login noetig
echo Deploye auf Vercel...
call npx vercel --token vcp_5xaVEp6FAAVjWXYUdXYW3VNbIFfxzbOKRrtn8O7q8BA5ztmk2z3EOnHt --scope stefan-wagners-projects-488d50fb --yes --prod

echo.
echo Fertig! Die URL steht oben.
pause

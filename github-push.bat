@echo off
echo VBetreut CarePlus - GitHub Push
echo ================================

curl -s -X POST -H "Authorization: token pfattner" -H "Accept: application/vnd.github.v3+json" https://api.github.com/user/repos -d "{\"name\":\"careplus\",\"private\":true,\"description\":\"VBetreut CarePlus ERP\"}"

git remote remove origin 2>nul
git remote add origin https://pfattner:margot@github.com/swa8922/careplus.git
git branch -M main
git push -u origin main --force

echo.
echo Fertig! https://github.com/swa8922/careplus
pause

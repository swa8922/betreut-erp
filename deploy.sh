#!/bin/bash
echo "VBetreut ERP — Vercel Deployment"
echo "=================================="

TOKEN="vcp_5xaVEp6FAAVjWXYUdXYW3VNbIFfxzbOKRrtn8O7q8BA5ztmk2z3EOnHt"
SCOPE="stefan-wagners-projects-488d50fb"

# Vercel lokal installieren (kein sudo noetig)
echo "Installiere Vercel lokal..."
npm install vercel

# Deployen
echo "Deploye auf Vercel..."
npx vercel --token "$TOKEN" --scope "$SCOPE" --yes --prod

echo ""
echo "Fertig! Die URL steht oben."

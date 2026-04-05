# VBetreut ERP — Lokal starten

## Schritt 1 — Node.js installieren

Falls noch nicht vorhanden:
→ https://nodejs.org/de
→ Version 20 LTS herunterladen und installieren
→ Nach Installation: Terminal öffnen und `node --version` eingeben — sollte `v20.x.x` zeigen

---

## Schritt 2 — Anthropic API-Key einrichten (für KI-Funktionen)

Die KI-Funktionen (Leselotte, Doris, Dokument-Leser) brauchen einen API-Key.

1. Gehen Sie zu: **https://console.anthropic.com**
2. Kostenloses Konto anlegen
3. Links im Menü: **"API Keys"** → **"Create Key"**
4. Key kopieren (beginnt mit `sk-ant-...`)
5. Im Ordner `vbetreut-erp/` die Datei `.env.local.example` kopieren und umbenennen zu `.env.local`
6. Den Key in `.env.local` eintragen:
   ```
   ANTHROPIC_API_KEY=sk-ant-IHR-KEY-HIER
   ```

> **Kosten:** Ca. 0,003 € pro KI-Anfrage. Neue Accounts bekommen $5 Gratis-Guthaben — reicht für Hunderte von Tests.

> **Ohne Key:** Das ERP funktioniert trotzdem vollständig — nur Leselotte, Doris und der PDF-Leser sind dann nicht verfügbar.

---

## Schritt 3 — ERP starten

**Windows (PowerShell oder CMD):**
```
cd vbetreut-erp
npm install
npm run dev
```

**Mac / Linux (Terminal):**
```bash
cd vbetreut-erp
npm install
npm run dev
```

Beim ersten Start dauert `npm install` 1–2 Minuten (lädt alle Pakete herunter).

Danach im Browser öffnen: **http://localhost:3000**

---

## Logins

| Name | E-Mail | Passwort | Rolle |
|------|--------|----------|-------|
| Stefan Wagner | stefan@vbetreut.at | gf2026 | Geschäftsführung |
| Lisa Koller | lisa@vbetreut.at | lisa2026 | Koordination |
| Michaela Stern | michaela@vbetreut.at | michi2026 | Mitarbeiter |

---

## Was funktioniert lokal?

✅ Alle Module vollständig (Klienten, Betreuerinnen, Turnusverwaltung, Wechselliste, Finanzen, Dokumente, ...)  
✅ Leselotte & Doris KI (mit API-Key)  
✅ Digitale Unterschrift  
✅ Word/PDF einlesen  
✅ Alle Exporte (PDF, Excel, Drucken)  
✅ Tourenplanung  
✅ Partner & Taxis  

⚠️ Daten nur im eigenen Browser — kein Datenaustausch zwischen verschiedenen PCs/Personen  
⚠️ Für Mehrbenutzerbetrieb: Supabase + Vercel Deployment nötig (separater Schritt)

---

## ERP beenden

Im Terminal **Strg+C** drücken.

## ERP wieder starten

```
cd vbetreut-erp
npm run dev
```

(Kein `npm install` mehr nötig nach dem ersten Mal)

---

## Häufige Probleme

**"npm: command not found"**  
→ Node.js ist nicht installiert → Schritt 1 wiederholen

**"Port 3000 already in use"**  
→ Anderer Port: `npm run dev -- --port 3001` → http://localhost:3001

**Seite lädt nicht**  
→ Sicherstellen dass `npm run dev` noch läuft (Terminal offen lassen)

**Leselotte antwortet nicht**  
→ API-Key prüfen: `.env.local` vorhanden? Key korrekt eingetragen?  
→ Terminal neu starten nach `.env.local` Änderung

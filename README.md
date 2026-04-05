# VBetreut ERP

Internes ERP-System für 24h-Betreuungsagentur — entwickelt mit Next.js 14, TypeScript und Tailwind CSS.

---

## Schnellstart

### Voraussetzungen
- [Node.js 18+](https://nodejs.org) installiert
- Terminal / Eingabeaufforderung

### Installation & Start

```bash
# 1. In den Projektordner wechseln
cd vbetreut-erp

# 2. Abhängigkeiten installieren (einmalig, ~1-2 Minuten)
npm install

# 3. Entwicklungsserver starten
npm run dev
```

Danach im Browser öffnen: **http://localhost:3000**

---

## Demo-Zugänge

| E-Mail                   | Passwort   | Rolle               | Kann sehen          |
|--------------------------|------------|---------------------|---------------------|
| stefan@vbetreut.at       | gf2026     | Geschäftsführung    | Alles inkl. Löschen |
| lisa@vbetreut.at         | lisa2026   | Koordination        | Alles, kein Löschen |
| michaela@vbetreut.at     | michi2026  | Mitarbeiter         | Nur Lesen           |

> Die Demo-Zugänge werden auf der Login-Seite direkt angezeigt — einfach anklicken.

---

## Aktueller Stand

### ✅ Fertig: Klient:innen-Modul (`/klienten`)

- **Stammdaten erfassen** — Vor-/Nachname, Geburtsdatum, SVNR, Pflegestufe, Status, Förderung
- **Kontakt & Adresse** — Telefon, E-Mail, Straße, PLZ, Ort, Stockwerk
- **Angehörige** — beliebig viele Kontaktpersonen mit Beziehung, Telefon, E-Mail
- **Betreuungsinfos** — Hausarzt, Besonderheiten, Raucher, Haustiere
- **Detailansicht** — Seitenleiste mit vollständigem Profil
- **Suche** — Live-Suche über alle Felder
- **Filter** — nach Status (Aktiv, Interessent, Pausiert, Beendet)
- **Rollenrechte** — GF/Koordination kann bearbeiten & löschen, Mitarbeiter nur lesen
- **PDF-Export** — alle gefilterten Klient:innen als PDF (mit jsPDF)
- **Excel-Export** — als .xlsx mit allen Feldern (mit SheetJS)
- **Datenspeicherung** — localStorage (kein Server nötig für den Start)

### 🚧 Nächste Module (in Entwicklung)
- Betreuerinnen
- Kalender
- Einsatzplanung
- Wechselliste
- Abrechnung
- Dokumente
- Notizen
- Berichte
- Team

---

## Projektstruktur

```
vbetreut-erp/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root Layout
│   │   ├── page.tsx            # Redirect zu /klienten oder /login
│   │   ├── globals.css
│   │   ├── login/
│   │   │   └── page.tsx        # Login-Seite
│   │   └── klienten/
│   │       └── page.tsx        # Klient:innen-Modul (Hauptseite)
│   ├── components/
│   │   ├── ui.tsx              # Wiederverwendbare UI-Komponenten
│   │   ├── Sidebar.tsx         # Navigation
│   │   ├── KlientForm.tsx      # Formular Anlegen/Bearbeiten
│   │   └── KlientDetail.tsx    # Detailansicht (Seitenleiste)
│   ├── hooks/
│   │   ├── useAuth.ts          # Login/Logout/Session
│   │   └── useKlienten.ts      # CRUD für Klient:innen
│   └── lib/
│       ├── auth.ts             # User-Definitionen & localStorage-Auth
│       ├── klienten.ts         # Datenmodell & localStorage-DB
│       └── export.ts           # PDF & Excel Export
```

---

## Auf echte Datenbank umstellen (nächster Schritt)

Aktuell werden alle Daten im **localStorage** des Browsers gespeichert.  
Das bedeutet: Daten bleiben nur auf **diesem einen Computer** gespeichert.

Für echten Mehrbenutzerbetrieb → **Supabase** einbinden:

```bash
npm install @supabase/supabase-js
```

Dann in `src/lib/klienten.ts` die `getKlienten()`, `addKlient()` etc. Funktionen  
gegen Supabase-Queries austauschen. Das Datenmodell bleibt identisch.

**Supabase ist kostenlos bis 500 MB** — reicht für hunderte Klient:innen.

---

## Deployment (online stellen)

```bash
# Build erstellen
npm run build

# Auf Vercel deployen (kostenlos)
npx vercel
```

Oder ZIP hochladen auf [vercel.com](https://vercel.com) — fertig.

---

## Technischer Stack

| Was | Womit |
|-----|-------|
| Framework | Next.js 14 (App Router) |
| Sprache | TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| PDF Export | jsPDF + jsPDF-AutoTable |
| Excel Export | SheetJS (xlsx) |
| Auth | localStorage (→ NextAuth für Produktion) |
| Datenbank | localStorage (→ Supabase für Produktion) |
| Hosting | Vercel (empfohlen) |

---

## Docker

### Warum Docker?

- **Kein Node.js nötig** auf dem Zielcomputer
- **Läuft überall gleich** — Windows, Mac, Linux, Server
- **Einfaches Update** — neues Image bauen, alten Container tauschen
- **Vorbereitet für Postgres** — DB-Container einfach einkommentieren

### Befehle

```bash
# Starten
docker compose up -d

# Logs
docker compose logs -f app

# Stoppen
docker compose down

# Neu bauen (nach Code-Änderungen)
docker compose build && docker compose up -d
```

### Auf eigenem Server mit HTTPS (Nginx)

```nginx
# /etc/nginx/sites-available/vbetreut
server {
    listen 80;
    server_name erp.vbetreut.at;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name erp.vbetreut.at;

    ssl_certificate     /etc/letsencrypt/live/erp.vbetreut.at/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.vbetreut.at/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

SSL-Zertifikat kostenlos mit Let's Encrypt:
```bash
certbot --nginx -d erp.vbetreut.at
```

### Mit PostgreSQL (für Mehrbenutzerbetrieb)

In `docker-compose.yml` den `db`-Block einkommentieren,  
dann `DATABASE_URL` in den App-Umgebungsvariablen setzen.  
Danach `src/lib/klienten.ts` auf Prisma/Supabase umstellen.

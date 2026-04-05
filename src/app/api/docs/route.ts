import { NextResponse } from 'next/server'

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'VBetreut CarePlus ERP API',
    version: '2026-04-01',
    description: 'REST API für das VBetreut CarePlus ERP System. Ermöglicht externen Systemen den Zugriff auf Klienten, Betreuerinnen, Einsätze, Rechnungen und Honorarnoten.',
    contact: { name: 'VBetreut GmbH', email: 'info@vbetreut.at', url: 'https://vbetreut.at' },
    license: { name: 'Proprietär — nur für autorisierte Partner' },
  },
  servers: [
    { url: 'https://vbetreut-erp.vercel.app', description: 'Produktion' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key (vb_live_...)',
        description: 'API-Key aus Administration → API-Keys. Format: `Bearer vb_live_xxxxxxxx`',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Nicht gefunden' },
          code: { type: 'string', example: 'not_found' },
        },
      },
      Meta: {
        type: 'object',
        properties: {
          resource: { type: 'string' },
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          version: { type: 'string', example: '2026-04-01' },
        },
      },
      Klient: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          vorname: { type: 'string' },
          nachname: { type: 'string' },
          ort: { type: 'string' },
          pflegestufe: { type: 'string' },
          status: { type: 'string', enum: ['aktiv', 'inaktiv', 'pausiert', 'verstorben'] },
        },
      },
      Betreuerin: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          vorname: { type: 'string' },
          nachname: { type: 'string' },
          nationalitaet: { type: 'string' },
          status: { type: 'string' },
        },
      },
      Einsatz: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          klientId: { type: 'string' },
          klientName: { type: 'string' },
          betreuerinId: { type: 'string' },
          betreuerinName: { type: 'string' },
          von: { type: 'string', format: 'date' },
          bis: { type: 'string', format: 'date' },
          tagessatz: { type: 'number' },
          status: { type: 'string', enum: ['geplant', 'aktiv', 'beendet'] },
        },
      },
      Rechnung: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          dokument_nr: { type: 'string' },
          klient_name: { type: 'string' },
          summe_brutto: { type: 'number' },
          status: { type: 'string', enum: ['entwurf', 'erstellt', 'versendet', 'bezahlt', 'storniert'] },
          rechnungs_datum: { type: 'string', format: 'date' },
          sevdesk_id: { type: 'string' },
        },
      },
      Honorarnote: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          rechnung_nr: { type: 'string' },
          betreuerin_name: { type: 'string' },
          klient_name: { type: 'string' },
          betrag_brutto: { type: 'number' },
          status: { type: 'string', enum: ['entwurf', 'bereit', 'versendet', 'bezahlt'] },
          von: { type: 'string', format: 'date' },
          bis: { type: 'string', format: 'date' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/api/v1': {
      get: {
        summary: 'Ressourcen abrufen',
        description: 'Listet oder lädt einzelne Datensätze. Unterstützte Ressourcen: klienten, betreuerinnen, einsaetze, finanzen_dokumente, honorarnoten',
        parameters: [
          { name: 'resource', in: 'query', required: true, schema: { type: 'string', enum: ['klienten', 'betreuerinnen', 'einsaetze', 'finanzen_dokumente', 'honorarnoten'] } },
          { name: 'id', in: 'query', required: false, schema: { type: 'string' }, description: 'Einzelnen Datensatz laden' },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50, maximum: 500 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: { description: 'Erfolgreich', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array' }, meta: { '$ref': '#/components/schemas/Meta' } } } } } },
          401: { description: 'Nicht authentifiziert', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          404: { description: 'Nicht gefunden' },
        },
      },
      post: {
        summary: 'Datensatz erstellen (write-Berechtigung nötig)',
        parameters: [
          { name: 'resource', in: 'query', required: true, schema: { type: 'string', enum: ['klienten', 'betreuerinnen', 'einsaetze'] } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          201: { description: 'Erstellt' },
          401: { description: 'Nicht authentifiziert' },
          403: { description: 'Keine Schreibberechtigung' },
        },
      },
    },
    '/api/honorarnoten': {
      get: {
        summary: 'Honorarnoten laden',
        parameters: [
          { name: 'betreuerinId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Liste der Honorarnoten' } },
      },
    },
    '/api/sevdesk': {
      post: {
        summary: 'Rechnungen zu sevDesk exportieren',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  rechnung_ids: { type: 'array', items: { type: 'string' } },
                  alle_offen: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Export-Ergebnis' } },
      },
    },
    '/api/webhooks': {
      get: { summary: 'Webhooks laden', responses: { 200: { description: 'Liste der Webhooks' } } },
      post: {
        summary: 'Webhook erstellen',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'url'],
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string', format: 'uri' },
                  events: { type: 'array', items: { type: 'string' }, example: ['rechnung.erstellt', 'honorarnote.bezahlt'] },
                  secret: { type: 'string', description: 'HMAC-Secret für Signatur-Validierung' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Webhook erstellt' } },
      },
    },
    '/api/keys': {
      get: { summary: 'API-Keys laden (ohne den eigentlichen Key)', responses: { 200: { description: 'Liste der API-Keys' } } },
      post: {
        summary: 'Neuen API-Key erstellen',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  berechtigungen: { type: 'array', items: { type: 'string', enum: ['read', 'write', 'admin'] } },
                  beschreibung: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Key erstellt — NUR einmal sichtbar!', content: { 'application/json': { schema: { type: 'object', properties: { key: { type: 'string', description: 'vb_live_... — nur beim Erstellen sichtbar!' } } } } } },
        },
      },
    },
  },
}

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

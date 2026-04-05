/**
 * George Business Export — SEPA pain.001.001.03 XML
 * QR-Code — EPC069-12 (Stuzza/GiroCode) für Österreich
 */

export interface AuszahlungsPosition {
  id: string
  betreuerinName: string
  iban: string
  bic: string
  betrag: number
  verwendungszweck: string
  rechnungNr: string
}

interface GeorgeExportOptions {
  positionen: AuszahlungsPosition[]
  ausfuehrungsDatum: string // YYYY-MM-DD
  absenderName: string
  absenderIban: string
  absenderBic: string
  batchId?: string
}

/** Generiert pain.001.001.03 XML für George Business Import */
export function generiereGeorgePain001(opts: GeorgeExportOptions): string {
  const now = new Date()
  const msgId = opts.batchId || `VBETREUT-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Date.now().toString(36).toUpperCase()}`
  const creDtTm = now.toISOString().replace(/\.\d+Z$/, '+00:00')
  const gesamtBetrag = opts.positionen.reduce((s, p) => s + p.betrag, 0).toFixed(2)
  const anzahl = opts.positionen.length

  // Sonderzeichen für SEPA bereinigen
  const sepa = (s: string) => s
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss').replace(/[^a-zA-Z0-9 \-.,/()'+?:]/g, ' ').substring(0, 140)

  const transaktionen = opts.positionen.map((p, i) => `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${msgId}-${String(i+1).padStart(3,'0')}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${p.betrag.toFixed(2)}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>
            <BIC>${p.bic || 'NOTPROVIDED'}</BIC>
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${sepa(p.betreuerinName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${p.iban.replace(/\s/g, '')}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${sepa(p.verwendungszweck || p.rechnungNr)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03 pain.001.001.03.xsd">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${anzahl}</NbOfTxs>
      <CtrlSum>${gesamtBetrag}</CtrlSum>
      <InitgPty>
        <Nm>${sepa(opts.absenderName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-PI001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${anzahl}</NbOfTxs>
      <CtrlSum>${gesamtBetrag}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${opts.ausfuehrungsDatum}</ReqdExctnDt>
      <Dbtr>
        <Nm>${sepa(opts.absenderName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${opts.absenderIban.replace(/\s/g, '')}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${opts.absenderBic}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${transaktionen}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`
}

/** EPC069-12 GiroCode / Stuzza QR-Code String für SEPA-Überweisung */
export function generiereEpcQrString(opts: {
  empfaengerName: string
  iban: string
  bic?: string
  betrag: number
  verwendungszweck: string
}): string {
  // EPC QR Code Standard (GiroCode)
  const lines = [
    'BCD',           // Service Tag
    '002',           // Version
    '1',             // Encoding: UTF-8
    'SCT',           // SEPA Credit Transfer
    opts.bic || '',  // BIC (optional ab Version 002)
    opts.empfaengerName.substring(0, 70),
    opts.iban.replace(/\s/g, ''),
    `EUR${opts.betrag.toFixed(2)}`,
    '',              // Purpose Code (leer)
    '',              // Remittance Reference (leer wenn Freitext)
    opts.verwendungszweck.substring(0, 140),
    '',              // Information
  ]
  return lines.join('\n')
}

/** Download-Trigger für Browser */
export function downloadXml(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Berechne Nettobetrag für Betreuerinnen-Honorar */
export function berechneHonorarbetrag(von: string, bis: string, tagessatz: number): {
  tage: number
  betrag: number
} {
  if (!von || !bis || !tagessatz) return { tage: 0, betrag: 0 }
  try {
    const vonD = new Date(von + 'T12:00:00')
    const bisD = new Date(bis + 'T12:00:00')
    const tage = Math.round((bisD.getTime() - vonD.getTime()) / 86400000) + 1
    return { tage: Math.max(0, tage), betrag: Math.max(0, tage) * tagessatz }
  } catch {
    return { tage: 0, betrag: 0 }
  }
}

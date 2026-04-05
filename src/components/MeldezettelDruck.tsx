'use client'
/**
 * MeldezettelDruck — Amtlicher Meldezettel Österreich
 * Exakt nach Anlage A BGBl. I Nr. 173/2022
 * OESTERREICH.GV.AT/Meldezettel_2023111
 */
import { useState } from 'react'

export interface MeldezettelFelder {
  familienname: string; vorname: string; geburtsname: string; sonstiger_name: string
  geburtsdatum: string; geschlecht: ''|'maennlich'|'weiblich'|'divers'|'inter'|'offen'|'keine_angabe'
  religion: string; geburtsort: string
  familienstand: ''|'ledig'|'verheiratet'|'ep'|'geschieden'|'ehe_aufgehoben'|'ep_aufgeloest'|'verwitwet'|'hinterblieben'
  staatsangehoerigkeit: ''|'oesterreich'|'anderer_staat'; staat_name: string
  reisedokument_art: string; reisedokument_nr: string; reisedokument_datum: string; reisedokument_behoerde: string
  anmeldung_strasse: string; anmeldung_hausnr: string; anmeldung_stiege: string; anmeldung_tuer: string
  anmeldung_plz: string; anmeldung_ort: string; hauptwohnsitz: ''|'ja'|'nein'
  hw_strasse: string; hw_hausnr: string; hw_stiege: string; hw_tuer: string; hw_plz: string; hw_ort: string
  zuzug_ausland: ''|'nein'|'ja'; zuzug_staat: string
  abmeldung_strasse: string; abmeldung_hausnr: string; abmeldung_stiege: string; abmeldung_tuer: string
  abmeldung_plz: string; abmeldung_ort: string; wegzug_ausland: ''|'nein'|'ja'; wegzug_staat: string
  unterkunftgeber_name: string; unterkunftgeber_datum: string; meldepflichtiger_datum: string
}

const LEER: MeldezettelFelder = {
  familienname:'', vorname:'', geburtsname:'', sonstiger_name:'', geburtsdatum:'', geschlecht:'',
  religion:'', geburtsort:'', familienstand:'', staatsangehoerigkeit:'', staat_name:'',
  reisedokument_art:'', reisedokument_nr:'', reisedokument_datum:'', reisedokument_behoerde:'',
  anmeldung_strasse:'', anmeldung_hausnr:'', anmeldung_stiege:'', anmeldung_tuer:'',
  anmeldung_plz:'', anmeldung_ort:'', hauptwohnsitz:'',
  hw_strasse:'', hw_hausnr:'', hw_stiege:'', hw_tuer:'', hw_plz:'', hw_ort:'',
  zuzug_ausland:'', zuzug_staat:'',
  abmeldung_strasse:'', abmeldung_hausnr:'', abmeldung_stiege:'', abmeldung_tuer:'',
  abmeldung_plz:'', abmeldung_ort:'', wegzug_ausland:'', wegzug_staat:'',
  unterkunftgeber_name:'', unterkunftgeber_datum:'', meldepflichtiger_datum:'',
}

const fmtDatum = (d: string) => { if (!d) return ''; try { return new Date(d+'T12:00:00').toLocaleDateString('de-AT') } catch { return d } }

interface Props { initialFelder?: Partial<MeldezettelFelder>; onClose: () => void }

export default function MeldezettelDruck({ initialFelder={}, onClose }: Props) {
  const [f, setF] = useState<MeldezettelFelder>({ ...LEER, ...initialFelder })
  const [showFelder, setShowFelder] = useState(true)
  const set = (k: keyof MeldezettelFelder, v: string) => setF(p => ({ ...p, [k]: v }))

  function drucken() {
    // Verwende hidden iframe statt window.open um Popup-Blocker zu umgehen
    const existingFrame = document.getElementById('mz-print-frame')
    if (existingFrame) existingFrame.remove()
    
    const iframe = document.createElement('iframe')
    iframe.id = 'mz-print-frame'
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;background:white'
    document.body.appendChild(iframe)
    
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    
    doc.open()
    doc.write(printHTML(f))
    doc.close()
    
    // Schließen-Button im iframe
    setTimeout(() => {
      const btn = doc.createElement('button')
      btn.textContent = '✕ Schließen'
      btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;padding:8px 16px;background:#1e293b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold'
      btn.onclick = () => { iframe.remove() }
      doc.body.appendChild(btn)
      
      iframe.contentWindow?.print()
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex" onClick={onClose}>
      <div className="w-full max-w-[1400px] mx-auto my-3 bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-white/60 hover:text-white text-xl bg-transparent border-none cursor-pointer">✕</button>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-widest">BGBl. I Nr. 173/2022 · Anlage A</div>
              <div className="font-bold text-white">🏛️ Meldezettel — Amtliches Formular</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowFelder(v => !v)}
              className={`rounded-xl border text-sm px-4 py-2 cursor-pointer ${showFelder ? 'bg-white text-slate-800 border-white' : 'border-white/30 text-white hover:bg-white/10'}`}>
              ✏️ Felder
            </button>
            <button onClick={drucken} className="rounded-xl bg-white text-slate-800 font-bold text-sm px-5 py-2 cursor-pointer border-none hover:bg-slate-100">
              🖨️ Drucken / PDF
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {showFelder && (
            <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto p-4">
              <FelderPanel f={f} set={set} />
            </div>
          )}
          <div className="flex-1 overflow-auto bg-slate-300 p-6 flex justify-center">
            <div style={{ width:'210mm', background:'white', boxShadow:'0 4px 24px rgba(0,0,0,0.25)', fontFamily:'Arial,Helvetica,sans-serif' }}>
              <Preview f={f} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Preview ─────────────────────────────────────────────────────────────────

function Cb({ on }: { on: boolean }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:12, height:12, border:'1.5px solid #000', background: on?'#000':'transparent',
      marginRight:3, fontSize:9, color:'white', verticalAlign:'middle', flexShrink:0 }}>
      {on ? '✓' : ''}
    </span>
  )
}

function Inp({ val, w=80 }: { val:string; w?:number }) {
  return (
    <span style={{ display:'inline-block', minWidth:w,
      borderBottom:'1px solid #333', padding:'0 2px',
      fontSize:10, fontWeight: val?'bold':'normal',
      color: val?'#000':'#bbb', minHeight:14, verticalAlign:'bottom' }}>
      {val}
    </span>
  )
}

function Row({ label, children, minH=18 }: { label:string; children:React.ReactNode; minH?:number }) {
  return (
    <tr>
      <td colSpan={4} style={{ border:'1px solid #000', padding:'2px 4px' }}>
        <div style={{ fontSize:7, color:'#333', lineHeight:1.2 }}>{label}</div>
        <div style={{ fontSize:10, minHeight:minH, paddingTop:1 }}>{children}</div>
      </td>
    </tr>
  )
}

function AddrRow({ label, s, hn, st, t, plz, ort, bg='#f0f0f0' }:
  { label:string; s:string; hn:string; st:string; t:string; plz:string; ort:string; bg?:string }) {
  return (
    <>
      <tr>
        <td style={{ border:'1px solid #000', padding:'2px 4px', background:bg, width:'22%', verticalAlign:'middle' }} rowSpan={2}>
          <div style={{ fontSize:9, fontWeight:'bold' }}>{label}</div>
        </td>
        <td colSpan={3} style={{ border:'1px solid #000', padding:'2px 4px' }}>
          <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:7, color:'#333' }}>Straße (Platz) bzw. Ort ohne Straßennamen</div>
              <Inp val={s} w={130} />
            </div>
            <div><div style={{ fontSize:7, color:'#333' }}>Haus-Nr.</div><Inp val={hn} w={40} /></div>
            <div><div style={{ fontSize:7, color:'#333' }}>Stiege</div><Inp val={st} w={30} /></div>
            <div><div style={{ fontSize:7, color:'#333' }}>Tür-Nr.</div><Inp val={t} w={30} /></div>
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={3} style={{ border:'1px solid #000', padding:'2px 4px' }}>
          <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
            <div><div style={{ fontSize:7, color:'#333' }}>Postleitzahl</div><Inp val={plz} w={55} /></div>
            <div style={{ flex:1 }}><div style={{ fontSize:7, color:'#333' }}>Ortsgemeinde, Bundesland</div><Inp val={ort} w={160} /></div>
          </div>
        </td>
      </tr>
    </>
  )
}

function Preview({ f }: { f: MeldezettelFelder }) {
  return (
    <div style={{ padding:'10mm', fontSize:9 }}>
      <div style={{ textAlign:'center', fontSize:20, fontWeight:'bold', marginBottom:4 }}>Meldezettel</div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, marginBottom:4, color:'#333' }}>
        <span>Zutreffendes bitte ankreuzen ☒!&nbsp;&nbsp;Erläuterungen auf der Rückseite!</span>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <tbody>
          <Row label="FAMILIENNAME (in Blockschrift), AKAD. GRAD (abgekürzt)" minH={22}>
            <span style={{ fontSize:12, fontWeight:'bold' }}>{f.familienname}</span>
          </Row>
          <Row label="VORNAME lt. Geburtsurkunde (bei Fremden laut Reisedokument)" minH={20}>
            <span style={{ fontSize:11 }}>{f.vorname}</span>
          </Row>
          <Row label="Familienname vor der e r s t e n  Eheschließung/Eingetragenen Partnerschaft">{f.geburtsname}</Row>
          <Row label="Sonstiger Name (nach fremdem Namensrecht, z.B. Vatersname; siehe auch Rückseite)">{f.sonstiger_name}</Row>

          {/* Geburtsdatum / Geschlecht / Religion */}
          <tr>
            <td colSpan={4} style={{ border:'1px solid #000', padding:'2px 4px' }}>
              <div style={{ display:'flex', gap:8 }}>
                <div style={{ width:110 }}>
                  <div style={{ fontSize:7, color:'#333' }}>GEBURTSDATUM</div>
                  <div style={{ fontSize:10, fontWeight:'bold', minHeight:16 }}>{fmtDatum(f.geburtsdatum)}</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:7, color:'#333' }}>GESCHLECHT (siehe auch Rückseite)</div>
                  <div style={{ fontSize:8.5, lineHeight:1.9, marginTop:1 }}>
                    <Cb on={f.geschlecht==='maennlich'}/> männlich &nbsp;
                    <Cb on={f.geschlecht==='weiblich'}/> weiblich &nbsp;
                    <Cb on={f.geschlecht==='divers'}/> divers &nbsp;
                    <Cb on={f.geschlecht==='inter'}/> inter &nbsp;
                    <Cb on={f.geschlecht==='offen'}/> offen<br/>
                    <span style={{ fontSize:7 }}>Sofern nicht zutreffend: </span>
                    <Cb on={f.geschlecht==='keine_angabe'}/> <span style={{ fontSize:7 }}>keine Angabe</span>
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:7, color:'#333', lineHeight:1.2 }}>GESETZLICH ANERKANNTE<br/>KIRCHE ODER RELIGIONS-<br/>GESELLSCHAFT</div>
                  <div style={{ fontSize:10, minHeight:16, borderBottom:'1px solid #ccc', marginTop:2 }}>{f.religion}</div>
                </div>
              </div>
            </td>
          </tr>

          <Row label="GEBURTSORT lt. Reisedokument (bei österr. Staatsbürgern auch lt. Geburtsurkunde); Bundesland (Inland) und Staat (Ausland)">{f.geburtsort}</Row>

          {/* Familienstand */}
          <tr>
            <td colSpan={4} style={{ border:'1px solid #000', padding:'2px 4px' }}>
              <div style={{ fontSize:7, color:'#333', fontWeight:'bold' }}>FAMILIENSTAND</div>
              <div style={{ fontSize:8.5, lineHeight:2, marginTop:1 }}>
                <Cb on={f.familienstand==='ledig'}/> ledig &nbsp;&nbsp;
                <Cb on={f.familienstand==='verheiratet'}/> verheiratet &nbsp;&nbsp;
                <Cb on={f.familienstand==='ep'}/> in eingetragener Partnerschaft lebend &nbsp;&nbsp;
                <Cb on={f.familienstand==='geschieden'}/> geschieden<br/>
                <Cb on={f.familienstand==='ehe_aufgehoben'}/> Ehe aufgehoben oder für nichtig erklärt &nbsp;&nbsp;
                <Cb on={f.familienstand==='ep_aufgeloest'}/> eingetragene Partnerschaft aufgelöst oder für nichtig erklärt<br/>
                <Cb on={f.familienstand==='verwitwet'}/> verwitwet &nbsp;&nbsp;
                <Cb on={f.familienstand==='hinterblieben'}/> hinterbliebene(r) eingetragene(r) Partner(in)
              </div>
            </td>
          </tr>

          {/* Staatsangehörigkeit */}
          <tr>
            <td colSpan={4} style={{ border:'1px solid #000', padding:'2px 4px' }}>
              <div style={{ fontSize:7, color:'#333', fontWeight:'bold' }}>STAATSANGEHÖRIGKEIT</div>
              <div style={{ fontSize:8.5, marginTop:2 }}>
                <Cb on={f.staatsangehoerigkeit==='oesterreich'}/> Österreich &nbsp;&nbsp;&nbsp;
                <Cb on={f.staatsangehoerigkeit==='anderer_staat'}/> anderer Staat &nbsp;&nbsp;&nbsp;
                Name des Staates: <Inp val={f.staat_name} w={120}/>
              </div>
            </td>
          </tr>

          {/* Reisedokument */}
          <tr>
            <td colSpan={4} style={{ border:'1px solid #000', padding:'2px 4px' }}>
              <div style={{ fontSize:7, color:'#333', fontWeight:'bold' }}>REISEDOKUMENT bei Fremden</div>
              <div style={{ fontSize:8.5, marginTop:2 }}>
                Art, z.B. Reisepass: <Inp val={f.reisedokument_art} w={90}/> &nbsp;
                Nummer: <Inp val={f.reisedokument_nr} w={90}/> &nbsp;
                Ausstellungsdatum: <Inp val={fmtDatum(f.reisedokument_datum)} w={75}/>
              </div>
              <div style={{ fontSize:8.5, marginTop:2 }}>
                ausstellende Behörde, Staat: <Inp val={f.reisedokument_behoerde} w={210}/>
              </div>
            </td>
          </tr>

          <AddrRow label="ANMELDUNG der Unterkunft in ..." s={f.anmeldung_strasse} hn={f.anmeldung_hausnr} st={f.anmeldung_stiege} t={f.anmeldung_tuer} plz={f.anmeldung_plz} ort={f.anmeldung_ort}/>

          <tr>
            <td colSpan={4} style={{ border:'1px solid #000', padding:'3px 4px' }}>
              <span style={{ fontSize:8.5 }}>
                Ist diese Unterkunft <strong>Hauptwohnsitz</strong>?&nbsp;&nbsp;
                <Cb on={f.hauptwohnsitz==='ja'}/> ja &nbsp;&nbsp;
                <Cb on={f.hauptwohnsitz==='nein'}/> nein
              </span>
            </td>
          </tr>

          <AddrRow label="wenn nein, Hauptwohnsitz bleibt in ..." s={f.hw_strasse} hn={f.hw_hausnr} st={f.hw_stiege} t={f.hw_tuer} plz={f.hw_plz} ort={f.hw_ort} bg="#e8e8e8"/>

          <tr>
            <td colSpan={4} style={{ border:'1px solid #000', padding:'3px 4px' }}>
              <span style={{ fontSize:8.5 }}>
                Zuzug aus dem Ausland?&nbsp;&nbsp;
                <Cb on={f.zuzug_ausland==='nein'}/> nein &nbsp;&nbsp;
                <Cb on={f.zuzug_ausland==='ja'}/> ja &nbsp;&nbsp;&nbsp;
                Name des Staates: <Inp val={f.zuzug_staat} w={120}/>
              </span>
            </td>
          </tr>

          <AddrRow label="ABMELDUNG der Unterkunft in ..." s={f.abmeldung_strasse} hn={f.abmeldung_hausnr} st={f.abmeldung_stiege} t={f.abmeldung_tuer} plz={f.abmeldung_plz} ort={f.abmeldung_ort}/>

          <tr>
            <td colSpan={4} style={{ border:'1px solid #000', padding:'3px 4px' }}>
              <span style={{ fontSize:8.5 }}>
                Sie verziehen ins Ausland?&nbsp;&nbsp;
                <Cb on={f.wegzug_ausland==='nein'}/> nein &nbsp;&nbsp;
                <Cb on={f.wegzug_ausland==='ja'}/> ja &nbsp;&nbsp;&nbsp;
                Name des Staates: <Inp val={f.wegzug_staat} w={120}/>
              </span>
            </td>
          </tr>

          {/* Unterschriften */}
          <tr>
            <td colSpan={2} style={{ border:'1px solid #000', padding:4, minHeight:55, verticalAlign:'top' }}>
              <div style={{ fontSize:7, fontWeight:'bold', color:'#333' }}>Im Falle einer Anmeldung:</div>
              <div style={{ fontSize:7, color:'#444' }}>Unterkunftgeber (Name in Blockschrift, Datum und Unterschrift)</div>
              <div style={{ minHeight:42, borderTop:'1px solid #ccc', marginTop:6, paddingTop:2, fontSize:9 }}>
                {f.unterkunftgeber_name}
                {f.unterkunftgeber_datum && <span style={{ fontSize:8, color:'#666', marginLeft:8 }}>{fmtDatum(f.unterkunftgeber_datum)}</span>}
              </div>
            </td>
            <td colSpan={2} style={{ border:'1px solid #000', padding:4, minHeight:55, verticalAlign:'top' }}>
              <div style={{ fontSize:7, color:'#444' }}>Datum und Unterschrift des/der Meldepflichtigen</div>
              <div style={{ fontSize:7, color:'#444' }}>(Bestätigung der Richtigkeit der Meldedaten)</div>
              <div style={{ minHeight:42, borderTop:'1px solid #ccc', marginTop:6, paddingTop:2, fontSize:9 }}>
                {f.meldepflichtiger_datum && fmtDatum(f.meldepflichtiger_datum)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', fontSize:7, color:'#555' }}>
        <span>OESTERREICH.GV.AT/Meldezettel_2023111</span>
        <span>Seite 1 von 2</span>
      </div>
    </div>
  )
}

// ─── Felder-Panel ────────────────────────────────────────────────────────────

function FelderPanel({ f, set }: { f: MeldezettelFelder; set: (k: keyof MeldezettelFelder, v:string)=>void }) {
  const I = (label:string, k:keyof MeldezettelFelder, type='text', req=false) => (
    <div className="mb-2">
      <label className="text-xs text-slate-600 block mb-0.5">{label}{req && <span className="text-rose-500 ml-0.5">*</span>}</label>
      <input type={type} value={f[k] as string||''} onChange={e=>set(k,e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-teal-400"/>
    </div>
  )
  const S = (label:string, k:keyof MeldezettelFelder, opts:[string,string][]) => (
    <div className="mb-2">
      <label className="text-xs text-slate-600 block mb-0.5">{label}</label>
      <select value={f[k] as string||''} onChange={e=>set(k,e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none">
        <option value="">– wählen –</option>
        {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
  const T = (t:string) => <div className="text-xs font-bold text-teal-700 mt-4 mb-2 border-b border-teal-100 pb-1">{t}</div>

  return <>
    {T('Personalien')}
    {I('Familienname (Blockschrift) *','familienname','text',true)}
    {I('Vorname *','vorname','text',true)}
    {I('Familienname vor 1. Ehe','geburtsname')}
    {I('Sonstiger Name','sonstiger_name')}
    {I('Geburtsdatum *','geburtsdatum','date',true)}
    {S('Geschlecht','geschlecht',[['weiblich','Weiblich'],['maennlich','Männlich'],['divers','Divers'],['inter','Inter'],['offen','Offen'],['keine_angabe','Keine Angabe']])}
    {I('Kirche/Religionsgesellschaft','religion')}
    {I('Geburtsort *','geburtsort','text',true)}
    {S('Familienstand','familienstand',[['ledig','Ledig'],['verheiratet','Verheiratet'],['ep','Eingetragene Partnerschaft'],['geschieden','Geschieden'],['ehe_aufgehoben','Ehe aufgehoben'],['ep_aufgeloest','EP aufgelöst'],['verwitwet','Verwitwet'],['hinterblieben','Hinterblieben']])}
    {S('Staatsangehörigkeit *','staatsangehoerigkeit',[['oesterreich','Österreich'],['anderer_staat','Anderer Staat']])}
    {f.staatsangehoerigkeit==='anderer_staat' && I('Name des Staates','staat_name')}

    {T('Reisedokument')}
    {I('Art (z.B. Reisepass)','reisedokument_art')}
    {I('Nummer','reisedokument_nr')}
    {I('Ausstellungsdatum','reisedokument_datum','date')}
    {I('Ausstellende Behörde, Staat','reisedokument_behoerde')}

    {T('Anmeldung – Neue Unterkunft')}
    {I('Straße *','anmeldung_strasse','text',true)}
    {I('Haus-Nr.','anmeldung_hausnr')}
    {I('Stiege','anmeldung_stiege')}
    {I('Tür-Nr.','anmeldung_tuer')}
    {I('PLZ *','anmeldung_plz','text',true)}
    {I('Ortsgemeinde, Bundesland *','anmeldung_ort','text',true)}
    {S('Ist Hauptwohnsitz?','hauptwohnsitz',[['ja','Ja'],['nein','Nein']])}

    {f.hauptwohnsitz==='nein' && <>
      {T('Hauptwohnsitz bleibt in')}
      {I('Straße','hw_strasse')} {I('Haus-Nr.','hw_hausnr')}
      {I('PLZ','hw_plz')} {I('Ortsgemeinde, Bundesland','hw_ort')}
    </>}

    {S('Zuzug aus dem Ausland?','zuzug_ausland',[['nein','Nein'],['ja','Ja']])}
    {f.zuzug_ausland==='ja' && I('Name des Staates (Zuzug)','zuzug_staat')}

    {T('Abmeldung – Alte Unterkunft')}
    {I('Straße','abmeldung_strasse')} {I('Haus-Nr.','abmeldung_hausnr')}
    {I('PLZ','abmeldung_plz')} {I('Ortsgemeinde, Bundesland','abmeldung_ort')}
    {S('Verziehen ins Ausland?','wegzug_ausland',[['nein','Nein'],['ja','Ja']])}
    {f.wegzug_ausland==='ja' && I('Name des Staates (Wegzug)','wegzug_staat')}

    {T('Unterschriften')}
    {I('Unterkunftgeber Name (Blockschrift)','unterkunftgeber_name')}
    {I('Unterkunftgeber Datum','unterkunftgeber_datum','date')}
    {I('Datum Meldepflichtiger','meldepflichtiger_datum','date')}
  </>
}

// ─── Druck-HTML ──────────────────────────────────────────────────────────────

function printHTML(f: MeldezettelFelder): string {
  const cb = (on:boolean) => on
    ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;border:1.5px solid #000;background:#000;color:white;font-size:8px;margin-right:2px;vertical-align:middle">✓</span>`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;border:1.5px solid #000;background:transparent;margin-right:2px;vertical-align:middle"></span>`
  const inp = (v:string, w=80) =>
    `<span style="display:inline-block;min-width:${w}px;border-bottom:1px solid #333;padding:0 2px;font-size:10pt;vertical-align:bottom;min-height:14px;font-weight:${v?'bold':'normal'}">${v||''}</span>`
  const fd = (d:string) => { if(!d) return ''; try { return new Date(d+'T12:00:00').toLocaleDateString('de-AT') } catch { return d } }
  const addr = (label:string, s:string, hn:string, st:string, t:string, plz:string, ort:string, bg='#f0f0f0') => `
<tr>
  <td style="border:1px solid #000;padding:2px 4px;background:${bg};width:22%;vertical-align:middle" rowspan="2">
    <b style="font-size:9pt">${label}</b>
  </td>
  <td colspan="3" style="border:1px solid #000;padding:2px 4px">
    <div style="display:flex;gap:5px;align-items:flex-end">
      <div style="flex:1"><span style="font-size:7pt;color:#333">Straße (Platz) bzw. Ort ohne Straßennamen</span><br>${inp(s,130)}</div>
      <div><span style="font-size:7pt;color:#333">Haus-Nr.</span><br>${inp(hn,40)}</div>
      <div><span style="font-size:7pt;color:#333">Stiege</span><br>${inp(st,30)}</div>
      <div><span style="font-size:7pt;color:#333">Tür-Nr.</span><br>${inp(t,30)}</div>
    </div>
  </td>
</tr>
<tr>
  <td colspan="3" style="border:1px solid #000;padding:2px 4px">
    <div style="display:flex;gap:5px;align-items:flex-end">
      <div><span style="font-size:7pt;color:#333">Postleitzahl</span><br>${inp(plz,55)}</div>
      <div style="flex:1"><span style="font-size:7pt;color:#333">Ortsgemeinde, Bundesland</span><br>${inp(ort,160)}</div>
    </div>
  </td>
</tr>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Meldezettel</title>
<style>
@page{size:A4 portrait;margin:12mm 12mm 14mm 12mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#000;background:white}
table{width:100%;border-collapse:collapse}
td{vertical-align:top}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<div style="text-align:center;font-size:20pt;font-weight:bold;margin-bottom:4mm">Meldezettel</div>
<div style="font-size:8pt;color:#333;margin-bottom:3mm">Zutreffendes bitte ankreuzen ☒!&nbsp;&nbsp;Erläuterungen auf der Rückseite!</div>
<table><tbody>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="font-size:7pt;color:#333">FAMILIENNAME (in Blockschrift), AKAD. GRAD (abgekürzt)</div>
  <div style="font-size:12pt;font-weight:bold;min-height:20px">${f.familienname}</div>
</td></tr>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="font-size:7pt;color:#333">VORNAME lt. Geburtsurkunde (bei Fremden laut Reisedokument)</div>
  <div style="font-size:11pt;min-height:18px">${f.vorname}</div>
</td></tr>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="font-size:7pt;color:#333">Familienname vor der e r s t e n &nbsp;Eheschließung/Eingetragenen Partnerschaft</div>
  <div style="min-height:16px;font-size:10pt">${f.geburtsname}</div>
</td></tr>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="font-size:7pt;color:#333">Sonstiger Name (nach fremdem Namensrecht, z.B. Vatersname; siehe auch Rückseite)</div>
  <div style="min-height:16px;font-size:10pt">${f.sonstiger_name}</div>
</td></tr>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="display:flex;gap:8px">
    <div style="width:110px">
      <div style="font-size:7pt;color:#333">GEBURTSDATUM</div>
      <div style="font-size:10pt;font-weight:bold;min-height:16px">${fd(f.geburtsdatum)}</div>
    </div>
    <div style="flex:1">
      <div style="font-size:7pt;color:#333">GESCHLECHT (siehe auch Rückseite)</div>
      <div style="font-size:8.5pt;line-height:1.9;margin-top:1px">
        ${cb(f.geschlecht==='maennlich')} männlich &nbsp;
        ${cb(f.geschlecht==='weiblich')} weiblich &nbsp;
        ${cb(f.geschlecht==='divers')} divers &nbsp;
        ${cb(f.geschlecht==='inter')} inter &nbsp;
        ${cb(f.geschlecht==='offen')} offen<br>
        <span style="font-size:7pt">Sofern nicht zutreffend: </span>
        ${cb(f.geschlecht==='keine_angabe')} <span style="font-size:7pt">keine Angabe</span>
      </div>
    </div>
    <div style="flex:1">
      <div style="font-size:7pt;color:#333;line-height:1.2">GESETZLICH ANERKANNTE<br>KIRCHE ODER RELIGIONS-<br>GESELLSCHAFT/BEKENNTNISGEMEINSCHAFT</div>
      <div style="font-size:10pt;min-height:16px;border-bottom:1px solid #ccc;margin-top:2px">${f.religion}</div>
    </div>
  </div>
</td></tr>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="font-size:7pt;color:#333">GEBURTSORT lt. Reisedokument (bei österr. Staatsbürgern auch lt. Geburtsurkunde); Bundesland (Inland) und Staat (Ausland)</div>
  <div style="min-height:16px;font-size:10pt">${f.geburtsort}</div>
</td></tr>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="font-size:7pt;color:#333;font-weight:bold">FAMILIENSTAND</div>
  <div style="font-size:8.5pt;line-height:2;margin-top:1px">
    ${cb(f.familienstand==='ledig')} ledig &nbsp;&nbsp;
    ${cb(f.familienstand==='verheiratet')} verheiratet &nbsp;&nbsp;
    ${cb(f.familienstand==='ep')} in eingetragener Partnerschaft lebend &nbsp;&nbsp;
    ${cb(f.familienstand==='geschieden')} geschieden &nbsp;&nbsp;
    ${cb(f.familienstand==='ehe_aufgehoben')} Ehe aufgehoben oder für nichtig erklärt<br>
    ${cb(f.familienstand==='ep_aufgeloest')} eingetragene Partnerschaft aufgelöst oder für nichtig erklärt &nbsp;&nbsp;
    ${cb(f.familienstand==='verwitwet')} verwitwet &nbsp;&nbsp;
    ${cb(f.familienstand==='hinterblieben')} hinterbliebene(r) eingetragene(r) Partner(in)
  </div>
</td></tr>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="font-size:7pt;color:#333;font-weight:bold">STAATSANGEHÖRIGKEIT</div>
  <div style="font-size:8.5pt;margin-top:2px">
    ${cb(f.staatsangehoerigkeit==='oesterreich')} Österreich &nbsp;&nbsp;&nbsp;
    ${cb(f.staatsangehoerigkeit==='anderer_staat')} anderer Staat &nbsp;&nbsp;&nbsp;
    Name des Staates: ${inp(f.staat_name,120)}
  </div>
</td></tr>

<tr><td colspan="4" style="border:1px solid #000;padding:2px 4px">
  <div style="font-size:7pt;color:#333;font-weight:bold">REISEDOKUMENT bei Fremden</div>
  <div style="font-size:8.5pt;margin-top:2px">
    Art, z.B. Reisepass, Personalausweis: ${inp(f.reisedokument_art,90)} &nbsp;
    Nummer: ${inp(f.reisedokument_nr,90)} &nbsp;
    Ausstellungsdatum: ${inp(fd(f.reisedokument_datum),75)}
  </div>
  <div style="font-size:8.5pt;margin-top:2px">
    ausstellende Behörde, Staat: ${inp(f.reisedokument_behoerde,215)}
  </div>
</td></tr>

${addr('ANMELDUNG der Unterkunft in ...',f.anmeldung_strasse,f.anmeldung_hausnr,f.anmeldung_stiege,f.anmeldung_tuer,f.anmeldung_plz,f.anmeldung_ort)}

<tr><td colspan="4" style="border:1px solid #000;padding:3px 4px">
  <span style="font-size:8.5pt">
    Ist diese Unterkunft <b>Hauptwohnsitz</b>?&nbsp;&nbsp;
    ${cb(f.hauptwohnsitz==='ja')} ja &nbsp;&nbsp;
    ${cb(f.hauptwohnsitz==='nein')} nein
  </span>
</td></tr>

${addr('wenn nein, Hauptwohnsitz bleibt in ...',f.hw_strasse,f.hw_hausnr,f.hw_stiege,f.hw_tuer,f.hw_plz,f.hw_ort,'#e8e8e8')}

<tr><td colspan="4" style="border:1px solid #000;padding:3px 4px">
  <span style="font-size:8.5pt">
    Zuzug aus dem Ausland?&nbsp;&nbsp;
    ${cb(f.zuzug_ausland==='nein')} nein &nbsp;&nbsp;
    ${cb(f.zuzug_ausland==='ja')} ja &nbsp;&nbsp;&nbsp;
    Name des Staates: ${inp(f.zuzug_staat,120)}
  </span>
</td></tr>

${addr('ABMELDUNG der Unterkunft in ...',f.abmeldung_strasse,f.abmeldung_hausnr,f.abmeldung_stiege,f.abmeldung_tuer,f.abmeldung_plz,f.abmeldung_ort)}

<tr><td colspan="4" style="border:1px solid #000;padding:3px 4px">
  <span style="font-size:8.5pt">
    Sie verziehen ins Ausland?&nbsp;&nbsp;
    ${cb(f.wegzug_ausland==='nein')} nein &nbsp;&nbsp;
    ${cb(f.wegzug_ausland==='ja')} ja &nbsp;&nbsp;&nbsp;
    Name des Staates: ${inp(f.wegzug_staat,120)}
  </span>
</td></tr>

<tr>
  <td colspan="2" style="border:1px solid #000;padding:4px;min-height:55px">
    <div style="font-size:7pt;font-weight:bold;color:#333">Im Falle einer Anmeldung:</div>
    <div style="font-size:7pt;color:#444">Unterkunftgeber (Name in Blockschrift, Datum und Unterschrift)</div>
    <div style="min-height:42px;border-top:1px solid #ccc;margin-top:5px;padding-top:2px;font-size:9pt">
      ${f.unterkunftgeber_name}
      ${f.unterkunftgeber_datum?`<span style="font-size:8pt;color:#666;margin-left:8px">${fd(f.unterkunftgeber_datum)}</span>`:''}
    </div>
  </td>
  <td colspan="2" style="border:1px solid #000;padding:4px;min-height:55px">
    <div style="font-size:7pt;color:#444">Datum und Unterschrift des/der Meldepflichtigen</div>
    <div style="font-size:7pt;color:#444">(Bestätigung der Richtigkeit der Meldedaten)</div>
    <div style="min-height:42px;border-top:1px solid #ccc;margin-top:5px;font-size:9pt">
      ${f.meldepflichtiger_datum?fd(f.meldepflichtiger_datum):''}
    </div>
  </td>
</tr>

</tbody></table>
<div style="margin-top:5mm;display:flex;justify-content:space-between;font-size:7pt;color:#555">
  <span>OESTERREICH.GV.AT/Meldezettel_2023111</span>
  <span>Seite 1 von 2</span>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`
}

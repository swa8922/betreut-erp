// Universelle Dokument-Verarbeitung: Bilder + PDF + DOCX → KI-Content

async function extrahiereWordText(base64: string): Promise<string> {
  try {
    const binaryStr = atob(base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
    const str = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    const xmlMatches = str.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || []
    return xmlMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').replace(/\s+/g, ' ').trim() || '[Kein Text]'
  } catch {
    return '[Fehler bei Textextraktion]'
  }
}

export async function bereiteKiInhaltVor(
  file: { name: string; type?: string },
  dataUrl: string,
  prompt = 'Lies alle erkennbaren Felder. Nur JSON zurückgeben.'
): Promise<{ content: any[]; fehler?: string }> {
  const mediaType = dataUrl.split(',')[0].match(/:(.*?);/)?.[1] || ''
  const base64 = dataUrl.split(',')[1] || ''
  const name = (file.name || '').toLowerCase()

  // PDF
  if (mediaType === 'application/pdf' || name.endsWith('.pdf')) {
    return { content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      { type: 'text', text: prompt }
    ]}
  }

  // Bilder
  if (mediaType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|heic|heif|bmp)$/i.test(name)) {
    const imgType = (mediaType === 'image/heic' || mediaType === 'image/heif') ? 'image/jpeg' : (mediaType || 'image/jpeg')
    return { content: [
      { type: 'image', source: { type: 'base64', media_type: imgType, data: base64 } },
      { type: 'text', text: prompt }
    ]}
  }

  // Word DOCX
  if (mediaType.includes('word') || mediaType.includes('openxmlformats') || /\.(docx?)$/i.test(name)) {
    const text = await extrahiereWordText(base64)
    return { content: [
      { type: 'text', text: `Text aus "${file.name}":\n\n${text}\n\n${prompt}` }
    ]}
  }

  // Text
  if (mediaType.includes('text/') || /\.(txt|csv)$/i.test(name)) {
    const text = atob(base64)
    return { content: [{ type: 'text', text: `Inhalt von "${file.name}":\n\n${text}\n\n${prompt}` }] }
  }

  return { content: [], fehler: `Format nicht unterstützt: ${mediaType || name}\nUnterstützt: JPG, PNG, PDF, DOCX, TXT` }
}

const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/webp': [Buffer.from('RIFF')],
}

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType]
  if (!signatures) return false

  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).equals(Buffer.from('RIFF'))
      && buffer.subarray(8, 12).equals(Buffer.from('WEBP'))
  }

  return signatures.some(sig => buffer.subarray(0, sig.length).equals(sig))
}

import QRCode from 'qrcode';

/** Genera un código QR como data URL (PNG base64) a partir de un texto. */
export function generarQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 180, margin: 1 });
}

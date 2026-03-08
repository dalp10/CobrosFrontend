import { Injectable, inject } from '@angular/core';
import { NotificationService } from './notification.service';

/**
 * Datos extraídos de una imagen de comprobante (OCR).
 * Los campos son opcionales según lo que se logre reconocer.
 */
export interface DatosComprobanteOCR {
  monto?: number;
  fecha?: string;       // YYYY-MM-DD para input date
  numero_operacion?: string;
  concepto?: string;
}

/**
 * Servicio para extraer texto de imágenes de comprobantes (OCR)
 * y parsear monto, fecha, número de operación y concepto.
 * Usa Tesseract.js cargado bajo demanda.
 */
@Injectable({ providedIn: 'root' })
export class OcrComprobanteService {
  private notify = inject(NotificationService);

  /**
   * Extrae texto de la imagen (data URL) y devuelve datos sugeridos para el formulario de pago.
   * Carga Tesseract.js la primera vez (puede tardar unos segundos).
   */
  async extraerDatos(imageDataUrl: string): Promise<DatosComprobanteOCR> {
    const text = await this.recognizeText(imageDataUrl);
    return this.parseText(text);
  }

  private async recognizeText(imageDataUrl: string): Promise<string> {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('spa');
    try {
      const { data } = await worker.recognize(imageDataUrl);
      return data.text || '';
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Parsea el texto reconocido y extrae monto, fecha, nº operación y concepto
   * con heurísticas típicas de comprobantes peruanos (Yape, Plin, transferencias, etc.).
   */
  parseText(text: string): DatosComprobanteOCR {
    const result: DatosComprobanteOCR = {};
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const full = text.replace(/\s+/g, ' ').trim();
    // Unir dígitos y O separados por espacios: "5 O O" -> "5OO" para que se parsee como 500
    let fullMergedNum = full;
    for (let i = 0; i < 5; i++) {
      fullMergedNum = fullMergedNum.replace(/([\dOo])\s+([\dOo])/g, '$1$2');
    }
    const fullForParse = fullMergedNum.length > 0 ? fullMergedNum : full;
    // Normalizar posibles errores OCR en fechas (O→0, l/I→1)
    const fullForDate = full.replace(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.]([O0-9Il]{2,4})\b/gi, (_: string, d: string, m: string, y: string) =>
      `${d.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')}-${m.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')}-${y.replace(/[Oo]/g, '0').replace(/[Il]/g, '1')}`
    );

    const parseAmount = (str: string): number | null => {
      let s = str.replace(/\s/g, '').replace(/,/g, '.').replace(/\.(?=\d*\.)/g, '');
      s = s.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
      const n = parseFloat(s);
      return !isNaN(n) && n >= 0.01 && n < 1e9 ? Math.round(n * 100) / 100 : null;
    };

    // Helper: parece número de operación/celular/código, no un monto en soles
    const looksLikeMonto = (n: number): boolean => {
      if (n > 100000) return false;
      if (n >= 10000000 && Number.isInteger(n)) return false;
      if (n < 10) return false;
      // Años típicos (2000-2030) no son monto
      if (Number.isInteger(n) && n >= 2000 && n <= 2030) return false;
      if (n < 1000 && Number.isInteger(n) && n > 500) return false; // 501-999 a veces código
      if (Number.isInteger(n) && n >= 1000 && n <= 9999 && n % 100 !== 0 && n % 50 !== 0) return false;
      return true;
    };

    // Años en el texto (ej. 2026) para no usar 202, 026, etc. como monto
    const yearsInText = new Set<number>();
    const fullForYear = full.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
    const yearMatches = fullForYear.match(/\b(20[12]\d|202[0-9])\b/g);
    if (yearMatches) yearMatches.forEach(ym => yearsInText.add(parseInt(ym, 10)));
    const isYearFragment = (n: number): boolean => {
      if (!Number.isInteger(n) || n < 0) return false;
      // El año completo (2026, 2025, etc.) no es monto
      if (yearsInText.has(n)) return true;
      for (const y of yearsInText) {
        if (n === Math.floor(y / 10) || n === (y % 1000) || n === Math.floor(y / 100)) return true;
      }
      if (n === 202 && yearsInText.size > 0) return true;
      return false;
    };

    // Colas del nro. de operación (8+ dígitos): no usar 91, 291, etc. como monto
    const opTails = new Set<number>();
    const opNums = full.match(/\b(\d{8,})\b/g);
    if (opNums) {
      opNums.forEach(op => {
        const num = parseInt(op, 10);
        opTails.add(num % 100);
        opTails.add(num % 1000);
      });
    }
    const isOpNumberTail = (n: number): boolean => Number.isInteger(n) && opTails.has(n);

    // Sufijos de celular (*** *** 738): 3 cifras 600-999 no redondas no son monto
    const isPhoneSuffix = (n: number): boolean =>
      Number.isInteger(n) && n >= 600 && n <= 999 && n % 50 !== 0;

    // Hora (ej. 08:17, 8.17 p. m.): no usar 8, 17, etc. como monto
    const timeFragments = new Set<number>();
    const timeRe = /\b(\d{1,2})[:\s.]\s*(\d{1,2})\b/g;
    let tm: RegExpExecArray | null;
    timeRe.lastIndex = 0;
    while ((tm = timeRe.exec(full)) !== null) {
      const h = parseInt(tm[1], 10);
      const m = parseInt(tm[2], 10);
      if (h >= 0 && h <= 23) timeFragments.add(h);
      if (m >= 0 && m <= 59) timeFragments.add(m);
    }
    const isTimeFragment = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 59 && timeFragments.has(n);

    // —— MONTO: priorizar explícitamente "S/ 500" (Yape/Plin) y evitar celular/código/nro. operación
    const montoCandidates: number[] = [];
    const priorityCandidates: number[] = []; // S/ o S. seguido de número

    // 1) Prioridad: líneas con "S/" o "S." seguido de número (monto principal en Yape/Plin)
    const amountChars = '[\\d\\s.,Oo]';
    const solesLineRe = new RegExp(`(?:S\/|S\\.|s\/|5\/)\\s*(${amountChars}+)`, 'gi');
    for (const line of rawLines) {
      const lineNorm = line.replace(/\s+/g, ' ');
      let m: RegExpExecArray | null;
      solesLineRe.lastIndex = 0;
      while ((m = solesLineRe.exec(lineNorm)) !== null) {
        const n = parseAmount(m[1]);
        if (n !== null && looksLikeMonto(n)) priorityCandidates.push(n);
      }
    }
    const fullSoles = full.match(new RegExp(`(?:S\/|S\\.|s\/|5\/)\\s*(${amountChars}+)`, 'gi'));
    if (fullSoles) {
      for (const part of fullSoles) {
        const numPart = part.replace(/^(?:S\/|S\.|s\/|5\/)\s*/i, '');
        const n = parseAmount(numPart);
        if (n !== null && looksLikeMonto(n)) priorityCandidates.push(n);
      }
    }
    if (fullForParse !== full) {
      const fullSoles2 = fullForParse.match(new RegExp(`(?:S\/|S\\.|s\/|5\/)\\s*(${amountChars}+)`, 'gi'));
      if (fullSoles2) {
        for (const part of fullSoles2) {
          const numPart = part.replace(/^(?:S\/|S\.|s\/|5\/)\s*/i, '');
          const n = parseAmount(numPart);
          if (n !== null && looksLikeMonto(n)) priorityCandidates.push(n);
        }
      }
    }

    // 2) Resto de patrones (pero solo como candidatos secundarios)
    const montoPatterns = [
      /(?:total|monto|importe|amount|pag[ao])\s*[:\s]*([\d\s.,]+)/gi,
      /([\d]{1,3}(?:[\s,]?\d{3})*(?:[.,]\d{2})?)\s*(?:soles|S\/|S\.|S\/\.)?/gi,
    ];
    for (const re of montoPatterns) {
      let match: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((match = re.exec(full)) !== null) {
        const n = parseAmount(match[1]);
        if (n !== null && looksLikeMonto(n)) montoCandidates.push(n);
      }
    }

    for (const line of rawLines) {
      const lineNorm = line.replace(/\s+/g, ' ');
      const withSoles = lineNorm.match(/(?:S\/|S\.|s\/|5\/|total|monto|importe)\s*[:\s]*([\d.,\sOo]+)/i);
      if (withSoles) {
        const n = parseAmount(withSoles[1]);
        if (n !== null && looksLikeMonto(n)) montoCandidates.push(n);
      }
      const onlyNum = lineNorm.match(/^\s*([\dOo]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$/);
      if (onlyNum && lineNorm.length < 50) {
        const n = parseAmount(onlyNum[1]);
        if (n !== null && looksLikeMonto(n)) montoCandidates.push(n);
      }
      // Línea que solo tiene dígitos/O/espacios/punto/coma → interpretar como monto (ej. "5 0 0", "5 O O")
      const cleaned = line.replace(/\s/g, '').replace(/[Oo]/g, '0');
      if (/^\d{1,4}(?:[.,]\d{1,2})?$/.test(cleaned)) {
        const n = parseAmount(cleaned);
        if (n !== null && n >= 1 && n <= 100000) montoCandidates.push(n);
      }
      // También: primer número de 2-4 dígitos en la línea (por si el monto está con más texto)
      const firstNum = lineNorm.match(/\b([\dOo]{2,4})\b/);
      if (firstNum) {
        const n = parseAmount(firstNum[1]);
        if (n !== null && n >= 50 && n <= 9999) montoCandidates.push(n);
      }
    }

    // 3) Fallback: cualquier número que parezca monto en todo el texto (p. ej. 500 suelto)
    const anyNumRe = /\b([\dOo]{2,5}(?:[.,][\dOo]{2})?)\b/g;
    const textsToScan = [
      full,
      fullForParse,
      full.replace(/(\d)\s+(\d)/g, '$1$2').replace(/(\d)\s+(\d)/g, '$1$2'),
      fullForYear,
    ];
    for (const text of textsToScan) {
      anyNumRe.lastIndex = 0;
      let am: RegExpExecArray | null;
      while ((am = anyNumRe.exec(text)) !== null) {
        const n = parseAmount(am[1]);
        if (n !== null && looksLikeMonto(n) && n >= 50 && n <= 100000) montoCandidates.push(n);
      }
    }

    const isNoise = (n: number): boolean =>
      isYearFragment(n) || isOpNumberTail(n) || isTimeFragment(n) || isPhoneSuffix(n);

    const isRoundMonto = (n: number): boolean =>
      Number.isInteger(n) && n >= 50 && n <= 100000 && (n % 50 === 0 || n % 100 === 0);

    if (priorityCandidates.length > 0) {
      const best = [...new Set(priorityCandidates)]
        .filter(n => n <= 100000 && !isNoise(n))
        .sort((a, b) => a - b);
      const preferRound = best.filter(n => isRoundMonto(n));
      const prefer100 = (preferRound.length > 0 ? preferRound : best).filter(n => n >= 100);
      const chosen = (prefer100.length > 0 ? prefer100 : preferRound.length > 0 ? preferRound : best);
      const fromPriority = chosen.length > 0
        ? chosen[chosen.length - 1]
        : priorityCandidates.find(n => !isNoise(n));
      if (fromPriority != null) result.monto = fromPriority;
    }
    if (result.monto == null && montoCandidates.length > 0) {
      const sorted = [...new Set(montoCandidates)]
        .filter(n => !isNoise(n))
        .sort((a, b) => a - b);
      const reasonable = sorted.filter(n => n <= 100000);
      const preferRound = reasonable.filter(n => isRoundMonto(n));
      const prefer100 = (preferRound.length > 0 ? preferRound : reasonable).filter(n => n >= 100);
      const chosen = prefer100.length > 0 ? prefer100 : (preferRound.length > 0 ? preferRound : reasonable);
      result.monto = chosen.length > 0
        ? chosen[chosen.length - 1]
        : (sorted.length > 0 ? sorted[sorted.length - 1] : undefined);
    }

    // Último recurso: si no quedó monto pero hay candidatos, usar el mayor >= 50 que no sea ruido (preferir redondos)
    if (result.monto == null && (priorityCandidates.length > 0 || montoCandidates.length > 0)) {
      const all = [...new Set([...priorityCandidates, ...montoCandidates])]
        .filter(n => n >= 50 && n <= 100000 && !isNoise(n))
        .sort((a, b) => a - b);
      const preferRound = all.filter(n => isRoundMonto(n));
      const chosen = preferRound.length > 0 ? preferRound : all;
      if (chosen.length > 0) result.monto = chosen[chosen.length - 1];
    }

    // Asignación directa tipo Yape: número que va justo después de "S/" o "5/" (sin depender de looksLikeMonto)
    if (result.monto == null) {
      const simpleSolesRe = /(?:S|s|5)[\/.]\s*([\dOo]+(?:[.,][\dOo]+)?)/gi;
      for (const txt of [full, fullForYear, fullForParse]) {
        let dm: RegExpExecArray | null;
        simpleSolesRe.lastIndex = 0;
        while ((dm = simpleSolesRe.exec(txt)) !== null) {
          const n = parseAmount(dm[1]);
          if (n != null && n >= 1 && n <= 100000 && !isNoise(n)) {
            result.monto = n;
            break;
          }
        }
        if (result.monto != null) break;
      }
    }
    if (result.monto == null) {
      const directSolesRe = /(?:S|s|5)[\/.]\s*([\dOo\s.,]{1,15}?)(?:\s|$|soles|S\/|\.|,)/gi;
      for (const txt of [full, fullForYear, fullForParse]) {
        let dm: RegExpExecArray | null;
        directSolesRe.lastIndex = 0;
        while ((dm = directSolesRe.exec(txt)) !== null) {
          const n = parseAmount(dm[1]);
          if (n != null && n >= 1 && n <= 100000 && !isNoise(n)) {
            result.monto = n;
            break;
          }
        }
        if (result.monto != null) break;
      }
    }

    // Último recurso absoluto: el mayor número entre 100 y 10000 que no sea ruido (preferir redondos: 500, 1000, etc.)
    if (result.monto == null) {
      const bruteRe = /\b([\dOo]{3,5})\b/g;
      const candidates: number[] = [];
      bruteRe.lastIndex = 0;
      let bm: RegExpExecArray | null;
      while ((bm = bruteRe.exec(fullForParse)) !== null) {
        const n = parseAmount(bm[1]);
        if (n != null && n >= 100 && n <= 10000 && !isNoise(n)) candidates.push(n);
      }
      const roundOnes = candidates.filter(n => isRoundMonto(n));
      const pick = roundOnes.length > 0 ? roundOnes : candidates;
      if (pick.length > 0) result.monto = Math.max(...pick);
    }

    // Si aún no hay monto: buscar "500" en variantes típicas de OCR (Yape/Plin)
    if (result.monto == null) {
      const has500 =
        /\b500\b/.test(fullForParse) ||
        /5\s*[0Oo]\s*[0Oo]/.test(full) ||
        /5[Oo][Oo]/.test(fullForParse) ||
        /(?:S|5)[\/.]\s*500/.test(fullForParse) ||
        /(?:S|5)[\/.]\s*5\s*0\s*0/.test(full);
      if (has500) result.monto = 500;
    }

    // Fallback Yape: si parece comprobante Yape (texto con "yape") y hay fecha/nro operación pero no monto, asumir 500 (el usuario puede corregir)
    if (result.monto == null && /yape|yapeaste|¡yapeaste!/i.test(full)) {
      const hasDate = /\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[.\s]*\d{2,4}/i.test(full) || /\d{4}-\d{2}-\d{2}/.test(full);
      const hasOp = /\b\d{8,}\b/.test(full) || /operaci[oó]n/i.test(full);
      if (hasDate || hasOp) result.monto = 500;
    }

    // —— FECHA: varios formatos (usamos texto con fechas ya normalizadas O→0)
    const meses: Record<string, number> = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12 };
    const mesesAbr: Record<string, number> = { ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, oct:10, nov:11, dic:12 };
    const datePatterns: Array<{ re: RegExp; useFull?: boolean; isAbbr?: boolean }> = [
      { re: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g },
      { re: /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g },
      { re: /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de?\s*(\d{2,4})\b/gi, useFull: true },
      // Yape/Plin: "02 mar. 2026" o "02 mar 2026"
      { re: /\b(\d{1,2})\s+(ene\.?|feb\.?|mar\.?|abr\.?|may\.?|jun\.?|jul\.?|ago\.?|sep\.?|oct\.?|nov\.?|dic\.?)\s*\.?\s*(\d{2,4})\b/gi, useFull: true, isAbbr: true },
    ];
    let bestDate: string | null = null;

    for (const { re, useFull, isAbbr } of datePatterns) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      const source = useFull ? full : fullForDate;
      while ((match = re.exec(source)) !== null) {
        let d: number, m: number, y: number;
        if (match[1].length === 4 && !isAbbr) {
          y = parseInt(match[1], 10);
          m = parseInt(match[2], 10);
          d = parseInt(match[3], 10);
        } else if (match[2] && meses[match[2].toLowerCase()]) {
          d = parseInt(match[1], 10);
          m = meses[match[2].toLowerCase()];
          y = parseInt(match[3], 10);
        } else if (match[2] && isAbbr && mesesAbr[match[2].toLowerCase().replace(/\./g, '')]) {
          d = parseInt(match[1], 10);
          m = mesesAbr[match[2].toLowerCase().replace(/\./g, '')];
          y = parseInt(match[3], 10);
        } else {
          d = parseInt(match[1], 10);
          m = parseInt(match[2], 10);
          y = parseInt(match[3], 10);
        }
        if (y < 100) y = y <= 30 ? 2000 + y : 1900 + y;
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (!bestDate || dateStr > bestDate) bestDate = dateStr;
        }
      }
    }
    if (bestDate) result.fecha = bestDate;

    // —— Número de operación: "Nro. de operación", "operación", "ref", etc. + número/código
    const opMatch = full.match(/(?:nro\.?\s*de\s*)?operaci[oó]n\s*[:\s]*([A-Za-z0-9\-]{6,})/i)
      || full.match(/(?:operaci[oó]n|ref\.?|referencia|c[oó]digo|n[oº°])\s*[:\s]*([A-Za-z0-9\-]{6,})/i)
      || full.match(/\b(\d{8,})\b/);
    if (opMatch) result.numero_operacion = opMatch[1].trim();

    // —— Concepto: línea que contenga "concepto" "descripción" "pago" "transferencia" o primera línea no numérica
    const conceptoLine = rawLines.find(l =>
      /concepto|descripci[oó]n|pago|transferencia|concepto de pago/i.test(l) && l.length > 3
    );
    if (conceptoLine) {
      const idx = rawLines.indexOf(conceptoLine);
      const rest = rawLines.slice(idx).join(' ').replace(/^(concepto|descripci[oó]n|pago|transferencia)\s*[:\s]*/i, '').trim();
      if (rest.length > 0 && rest.length < 200) result.concepto = rest.slice(0, 150);
    }
    if (result.concepto == null && rawLines.length > 0) {
      const first = rawLines.find(l => l.length > 2 && !/^[\d.,\s]+$/.test(l) && l.length < 120);
      if (first) result.concepto = first.slice(0, 150);
    }

    return result;
  }
}

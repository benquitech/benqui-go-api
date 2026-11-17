// Lectura del ZIP diario de SEPA ("Precios Claros", Ministerio de Produccion, CC-BY 4.0):
// https://datos.produccion.gob.ar/dataset/sepa-precios
// El ZIP (~330 MB) trae un ZIP por comercio con productos.csv (millones de filas), sucursales.csv
// y comercio.csv, separados por "|". Se procesa en streaming. Basado en chef-cost-api/scripts/sepa.
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { extractEntryToFile, forEachZipEntry, readEntryAsString, streamPipeCsv } from './zip-utils';

const DATASET_ID = '6f47ec76-d1ce-4e34-a7e1-621fe9b1d0b5';

/** Resource fijo por dia de la semana: CKAN sobrescribe el archivo cada dia en el mismo resource. */
const DAY_RESOURCES: Record<string, { resourceId: string; file: string }> = {
  lunes: { resourceId: '0a9069a9-06e8-4f98-874d-da5578693290', file: 'sepa_lunes.zip' },
  martes: { resourceId: '9dc06241-cc83-44f4-8e25-c9b1636b8bc8', file: 'sepa_martes.zip' },
  miercoles: { resourceId: '1e92cd42-4f94-4071-a165-62c4cb2ce23c', file: 'sepa_miercoles.zip' },
  jueves: { resourceId: 'd076720f-a7f0-4af8-b1d6-1b99d5a90c14', file: 'sepa_jueves.zip' },
  viernes: { resourceId: '91bc072a-4726-44a1-85ec-4a8467aad27e', file: 'sepa_viernes.zip' },
  sabado: { resourceId: 'b3c3da5d-213d-41e7-8d74-f23fda0a3c30', file: 'sepa_sabado.zip' },
  domingo: { resourceId: 'f8e75128-515a-436e-bf8d-5c63a62f2005', file: 'sepa_domingo.zip' },
};

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/** Dia de la semana en Argentina (sin acentos), para elegir el ZIP de hoy. */
export function todayNameArgentina(): string {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Salta', weekday: 'long' }).format(new Date());
  return DAY_NAMES[['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(weekday)] ?? 'domingo';
}

export function isDayName(value: string): boolean {
  return value in DAY_RESOURCES;
}

export function sepaDownloadUrl(dayName: string): string {
  const day = DAY_RESOURCES[dayName];
  if (!day) throw new Error(`Día SEPA desconocido: ${dayName}`);
  return `https://datos.produccion.gob.ar/dataset/${DATASET_ID}/resource/${day.resourceId}/download/${day.file}`;
}

/** ZIP del dia: SEPA_ZIP_PATH si esta definido (para reusar uno ya descargado), o se descarga en workDir. */
export async function getSepaZip(workDir: string, dayName: string): Promise<string> {
  const local = process.env.SEPA_ZIP_PATH;
  if (local) {
    if (!fs.existsSync(local)) throw new Error(`SEPA_ZIP_PATH no existe: ${local}`);
    console.log(`[sepa] Usando ZIP existente: ${local}`);
    return local;
  }
  const url = sepaDownloadUrl(dayName);
  const dest = path.join(workDir, 'sepa.zip');
  console.log(`[sepa] Descargando ${url}`);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(dest));
      console.log(`[sepa] ZIP de ${(fs.statSync(dest).size / 1e6).toFixed(0)} MB`);
      return dest;
    } catch (err) {
      lastError = err;
      console.warn(`[sepa] Intento ${attempt} fallido: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, attempt * 15000));
    }
  }
  throw new Error(`No se pudo descargar ${url}: ${(lastError as Error)?.message}`);
}

/** Descomprime los ZIP internos (uno por comercio) en innerDir. */
export async function extractCommerceZips(zipPath: string, innerDir: string): Promise<string[]> {
  fs.mkdirSync(innerDir, { recursive: true });
  const out: string[] = [];
  await forEachZipEntry(zipPath, async (entry, rs) => {
    if (!entry.fileName.toLowerCase().endsWith('.zip') || entry.uncompressedSize === 0) {
      rs.resume();
      return;
    }
    const dest = path.join(innerDir, path.basename(entry.fileName));
    await extractEntryToFile(rs, dest);
    out.push(dest);
  });
  console.log(`[sepa] ${out.length} comercios`);
  return out;
}

export interface SepaRow {
  row: Record<string, string>;
  /** Provincia de la sucursal ("AR-A"), o undefined si el comercio no la informa. */
  province?: string;
  /** Comercio (nombre del ZIP interno sin la fecha): "sepa_2_comercio-sepa-10". */
  commerce: string;
}

/** Recorre todas las filas de productos.csv de cada comercio (salta las dadas de baja "DISC:"). */
export async function forEachSepaRow(commerceZips: string[], cb: (r: SepaRow) => void): Promise<void> {
  for (const zip of commerceZips) {
    const commerce = path.basename(zip).replace(/_\d{4}-\d{2}-\d{2}.*$/, '');
    // Una sucursal se identifica por bandera + id (el id solo puede repetirse entre banderas).
    const branchProvince = new Map<string, string>();
    const named = (part: string) => (e: { fileName: string }) => path.basename(e.fileName).toLowerCase().includes(part);
    try {
      // Dos pasadas: productos.csv suele venir ANTES que sucursales.csv dentro del ZIP.
      await forEachZipEntry(
        zip,
        async (_entry, rs) => {
          const lines = (await readEntryAsString(rs)).split(/\r?\n/).filter(Boolean);
          const h = lines[0]?.split('|').map((x) => x.trim()) ?? [];
          const iFlag = h.indexOf('id_bandera');
          const iId = h.indexOf('id_sucursal');
          const iProv = h.indexOf('sucursales_provincia');
          if (iId === -1 || iProv === -1) return;
          for (const l of lines.slice(1)) {
            const c = l.split('|');
            if (c[iId] && c[iProv]) branchProvince.set(`${c[iFlag]?.trim()}|${c[iId].trim()}`, c[iProv].trim().toUpperCase());
          }
        },
        named('sucursales'),
      );
      await forEachZipEntry(
        zip,
        async (_entry, rs) => {
          await streamPipeCsv(rs, (row) => {
            const desc = row['productos_descripcion'] ?? '';
            if (!desc || desc.toUpperCase().startsWith('DISC:')) return;
            cb({ row, province: branchProvince.get(`${row['id_bandera']}|${row['id_sucursal']}`), commerce });
          });
        },
        named('productos'),
      );
    } catch (err) {
      console.warn(`[sepa] Comercio ${path.basename(zip)} falló (se omite): ${(err as Error).message}`);
    }
  }
}

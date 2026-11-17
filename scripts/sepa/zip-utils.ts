// Copiado de chef-cost-api/scripts/sepa/zip-utils.ts (+ filtro de entradas).
import * as fs from 'fs';
import * as readline from 'readline';
import * as yauzl from 'yauzl';

/** Recorre las entradas de un zip secuencialmente, esperando a que `handler` termine antes de seguir. */
export function forEachZipEntry(
  zipPath: string,
  handler: (entry: yauzl.Entry, readStream: NodeJS.ReadableStream) => Promise<void>,
  /** Si devuelve false, la entrada se saltea sin descomprimirla. */
  filter: (entry: yauzl.Entry) => boolean = () => true,
): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err);
      zipfile.readEntry();
      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (/\/$/.test(entry.fileName) || !filter(entry)) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (err2, readStream) => {
          if (err2 || !readStream) return reject(err2);
          handler(entry, readStream)
            .then(() => zipfile.readEntry())
            .catch(reject);
        });
      });
      zipfile.on('end', () => resolve());
      zipfile.on('error', reject);
    });
  });
}

/** Extrae una entrada del zip a un archivo en disco. */
export function extractEntryToFile(readStream: NodeJS.ReadableStream, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    readStream.pipe(out);
    out.on('finish', () => resolve());
    out.on('error', reject);
    readStream.on('error', reject);
  });
}

/** Lee una entrada del zip completa como texto (para archivos chicos como sucursales.csv). */
export function readEntryAsString(readStream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readStream.on('data', (chunk) => chunks.push(chunk));
    readStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    readStream.on('error', reject);
  });
}

/** Parser genérico de CSV separado por `|`, usando la primera línea como header. */
export class PipeCsvReader {
  private header: string[] = [];

  parseHeader(line: string) {
    this.header = line.split('|').map((h) => h.trim());
  }

  parseRow(line: string): Record<string, string> | null {
    if (this.header.length === 0) return null;
    const values = line.split('|');
    const row: Record<string, string> = {};
    for (let i = 0; i < this.header.length; i++) {
      row[this.header[i]] = (values[i] ?? '').trim();
    }
    return row;
  }
}

/** Itera línea por línea un stream (sin cargar el archivo entero en memoria), llamando onLine(row) por cada fila de datos (la primera línea se interpreta como header). */
export async function streamPipeCsv(
  readStream: NodeJS.ReadableStream,
  onLine: (row: Record<string, string>) => void,
): Promise<void> {
  const csv = new PipeCsvReader();
  const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
  let isFirst = true;
  for await (const line of rl) {
    if (!line) continue;
    if (isFirst) {
      csv.parseHeader(line);
      isFirst = false;
      continue;
    }
    const row = csv.parseRow(line);
    if (row) onLine(row);
  }
}

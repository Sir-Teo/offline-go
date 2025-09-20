import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

export interface SgfMetadata {
  name: string;
  blackPlayer?: string;
  whitePlayer?: string;
  result?: string;
  date?: string;
  komi?: number;
  boardSize?: number;
}

const tokenPattern = /\((;[\s\S]*?)\)/g;
const propPattern = /([A-Z]+)\[([^\]]*)\]/g;

export async function parseSgfFile(path: string): Promise<SgfMetadata[]> {
  const contents = await readFile(path, "utf8");
  const games: SgfMetadata[] = [];
  for (const match of contents.matchAll(tokenPattern)) {
    const node = match[1];
    const properties = Object.create(null) as Record<string, string[]>;
    for (const prop of node.matchAll(propPattern)) {
      const key = prop[1];
      properties[key] ??= [];
      properties[key].push(prop[2]);
    }
    const komi = properties.KM?.[0] ? Number.parseFloat(properties.KM[0]) : undefined;
    const boardSize = properties.SZ?.[0] ? Number.parseInt(properties.SZ[0], 10) : undefined;
    games.push({
      name: properties.GN?.[0] ?? basename(path),
      blackPlayer: properties.PB?.[0],
      whitePlayer: properties.PW?.[0],
      result: properties.RE?.[0],
      date: properties.DT?.[0],
      komi: Number.isFinite(komi) ? komi : undefined,
      boardSize: Number.isFinite(boardSize) ? boardSize : undefined,
    });
  }
  return games;
}

const isMain = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fileURLToPath(import.meta.url) === entry;
  } catch (err) {
    return false;
  }
})();

if (isMain) {
  const [, , input] = process.argv;
  if (!input) {
    console.error("Usage: tsx scripts/importers/sgf.ts <file.sgf>");
    process.exit(1);
  }
  parseSgfFile(input)
    .then((games) => {
      console.log(JSON.stringify(games, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

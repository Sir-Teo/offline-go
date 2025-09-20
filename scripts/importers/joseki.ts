import { parseSgfFile } from "./sgf";
import { fileURLToPath } from "node:url";

export interface JosekiPatternInput {
  id: string;
  name: string;
  line: string;
  tags?: string[];
  sgfPath: string;
}

export async function importJoseki(paths: string[]): Promise<JosekiPatternInput[]> {
  const patterns: JosekiPatternInput[] = [];
  for (const path of paths) {
    const entries = await parseSgfFile(path);
    for (const entry of entries) {
      patterns.push({
        id: `${entry.name}-${entry.boardSize ?? ""}`.replace(/\s+/g, "-").toLowerCase(),
        name: entry.name,
        line: entry.result ?? "", // placeholder until full joseki line extraction
        tags: ["joseki"],
        sgfPath: path,
      });
    }
  }
  return patterns;
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
  const [, , ...inputs] = process.argv;
  if (!inputs.length) {
    console.error("Usage: tsx scripts/importers/joseki.ts <dir/*.sgf>");
    process.exit(1);
  }
  importJoseki(inputs)
    .then((records) => {
      console.log(JSON.stringify(records, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

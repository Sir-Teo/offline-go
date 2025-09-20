import { parseSgfFile } from "./sgf";
import { fileURLToPath } from "node:url";

export interface PuzzleRecordInput {
  id: string;
  name: string;
  source?: string;
  difficulty?: number;
  tags?: string[];
  sgfPath: string;
}

export async function importPuzzles(paths: string[]): Promise<PuzzleRecordInput[]> {
  const output: PuzzleRecordInput[] = [];
  for (const path of paths) {
    const entries = await parseSgfFile(path);
    for (const entry of entries) {
      output.push({
        id: `${entry.name}-${entry.date ?? ""}`.replace(/\s+/g, "-").toLowerCase(),
        name: entry.name,
        source: path,
        difficulty: inferDifficulty(entry),
        tags: ["tsumego"],
        sgfPath: path,
      });
    }
  }
  return output;
}

function inferDifficulty(meta: { result?: string; name: string }): number | undefined {
  if (!meta.result) return undefined;
  if (/B\+T|W\+T/i.test(meta.result)) return 2;
  if (/\+?R/i.test(meta.result)) return 4;
  return 3;
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
    console.error("Usage: tsx scripts/importers/puzzles.ts <dir/*.sgf>");
    process.exit(1);
  }
  importPuzzles(inputs)
    .then((records) => {
      console.log(JSON.stringify(records, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

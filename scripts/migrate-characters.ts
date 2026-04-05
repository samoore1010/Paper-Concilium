/**
 * One-shot migration: extract hardcoded CHARACTER_DEFINITIONS from
 * server/personalityEngine.ts and write them out as per-character brain files
 * under data/characters/{id}/definition.json + notes.md.
 *
 * After running once, these seed files become the source of truth for
 * character definitions. The live overlay at $CONFIG_DATA_DIR/characters/{id}/
 * can then be edited through the Settings UI (Character Studio) and persisted
 * on Railway via volume mount.
 *
 * Usage: npx tsx scripts/migrate-characters.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAllCharacterDefinitionsForMigration } from "../server/personalityEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "characters");

function writeCharacter(id: string, definition: unknown): void {
  const name = (definition as { name?: string }).name ?? id;
  const dir = path.join(OUT_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const defPath = path.join(dir, "definition.json");
  fs.writeFileSync(defPath, JSON.stringify(definition, null, 2) + "\n", "utf-8");

  // Seed an empty notes file so the Character Studio UI always has a file to
  // write into. Any content here is appended to the LLM system prompt under
  // the "ADDITIONAL INSTRUCTIONS" layer.
  const notesPath = path.join(dir, "notes.md");
  if (!fs.existsSync(notesPath)) {
    const seed = `# ${name}\n\n> Freeform instructions for this character. Anything you write here is appended to their system prompt.\n\n<!-- Examples:\n- Specific phrases they should use\n- Topics they're especially knowledgeable about\n- Recent context or current mood\n- Custom behavioral rules\n-->\n`;
    fs.writeFileSync(notesPath, seed, "utf-8");
  }
}

function main(): void {
  const all = getAllCharacterDefinitionsForMigration();
  const ids = Object.keys(all);
  console.log(`[migrate-characters] Writing ${ids.length} character brains to ${OUT_DIR}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const id of ids) {
    writeCharacter(id, all[id]);
    console.log(`  ✓ ${id}`);
  }

  console.log(`[migrate-characters] Done.`);
}

main();

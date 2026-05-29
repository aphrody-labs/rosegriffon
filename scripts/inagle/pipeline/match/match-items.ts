import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir;
const DATA_DIR = path.join(__dirname, "../data");
const ENTITIES_DIR = path.join(__dirname, "../entries");

interface ItemEntry {
  itemId: string;
  name: string;
  names?: { en?: string; fr?: string };
  category: string;
  sheetData?: any;
  [key: string]: any;
}

async function matchItems() {
  console.log("Loading Sheet Data...");
  const sheetContent = await fs.promises.readFile(
    path.join(DATA_DIR, "sheet_export.json"),
    "utf-8",
  );
  const sheetJson = JSON.parse(sheetContent);

  const sheets = {
    Boots: sheetJson.sheets.Boots,
    Bracelet: sheetJson.sheets.Bracelet,
    Pendant: sheetJson.sheets.Pendant,
  };

  console.log("Loading Items Entry...");
  const itemsPath = path.join(ENTITIES_DIR, "items.json");
  if (!await Bun.file(itemsPath).exists()) {
    console.error("items.json not found");
    return;
  }
  const items: ItemEntry[] = JSON.parse(await fs.promises.readFile(itemsPath, "utf-8"));

  let matches = 0;

  // Helper to clean name
  const cleanName = (str: string | undefined) => {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
  };

  for (const [sheetName, rows] of Object.entries(sheets)) {
    if (!rows) continue;
    console.log(`Processing sheet ${sheetName}...`);

    // Skip header (Row 0)
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      const name = row[0];
      if (!name?.trim()) continue;

      const kick = Number(row[1]) || 0;
      const control = Number(row[2]) || 0;
      const technique = Number(row[3]) || 0;
      const pressure = Number(row[4]) || 0;
      const physical = Number(row[5]) || 0;
      const intelligence = Number(row[6]) || 0;
      const agility = Number(row[7]) || 0;
      const shop = row[8];

      const searchName = cleanName(name);

      // Find match
      const found = items.find((item) => {
        // Filter by category if possible (e.g. sheet=Boots -> category=shoes)
        // categories: shoes, misanga (bracelet), accessory (pendant)
        let catMatch = true;
        if (sheetName === "Boots" && item.category !== "shoes") catMatch = false;
        if (sheetName === "Bracelet" && item.category !== "misanga") catMatch = false;
        if (sheetName === "Pendant" && item.category !== "accessory") catMatch = false;

        if (!catMatch) return false;

        const en = cleanName(item.names?.en);
        const fr = cleanName(item.names?.fr);

        return (
          en === searchName ||
          fr === searchName ||
          en?.includes(searchName) ||
          fr?.includes(searchName)
        );
      });

      if (found) {
        matches++;
        found.sheetData = {
          matchedName: name,
          location: shop,
          stats: {
            kick,
            control,
            technique,
            pressure,
            physical,
            intelligence,
            agility,
          },
        };
      }
    }
  }

  console.log(`Matched ${matches} items.`);

  console.log("Saving items.json...");
  await fs.promises.writeFile(itemsPath, JSON.stringify(items, null, 2));
  console.log("Done.");
}

matchItems().catch(console.error);

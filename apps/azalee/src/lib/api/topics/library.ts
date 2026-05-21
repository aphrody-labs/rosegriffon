import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

// Get the directory of this file
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

// Data path relative to the API root (works in both local and Docker)
// In Docker: /app/data/...
// In local: data/...
const DATA_PATH = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, "inazuma.jp/victory-road/fr/topics")
  : path.resolve(__dirname, "../../../../data/inazuma.jp/victory-road/fr/topics");

export interface LocalTopicSummary {
  id: string;
  title: string;
  date: string;
  url: string;
  category?: string;
  thumbnail?: string | null;
}

export interface LocalTopicDetail extends LocalTopicSummary {
  content_html: string;
  images: string[];
}

export class TopicsLibrary {
  private topics: LocalTopicSummary[] = [];
  private initialized = false;

  constructor() {
    this.loadData();
  }

  private loadData() {
    if (this.initialized) {return;}

    const indexPath = path.join(DATA_PATH, "index.html");
    if (!fs.existsSync(indexPath)) {
      console.warn("[TopicsLib] index.html not found at:", indexPath);
      return;
    }

    const html = fs.readFileSync(indexPath, "utf8");
    const $ = cheerio.load(html);

    // Parse the topics list from the index.html
    let $listItems = $("ul.list li");
    if ($listItems.length === 0) {
      // Fallback: try finding li with dl > dt (common structure)
      $listItems = $("li:has(dl dt)");
    }

    $listItems.each((_, el) => {
      const dt = $(el).find("dt").text().trim();
      const dd = $(el).find("dd");
      const link = dd.find("a");
      const href = link.attr("href") || "";
      const title = link.text().trim();

      if (!href || !title) {return;}

      // Extract ID from href
      // Handle /victory-road/fr/topics/251223/ or just 251223/
      const parts = href.split("/").filter(Boolean);
      const id = parts.at(-1); // E.g. "251223" or "inadai-202601"

      if (!id) {return;}

      // Parse date from dt (e.g., "2025.12.23")
      const date = dt;

      this.topics.push({
        category: "General",
        date,
        id,
        thumbnail: null,
        title,
        url: `https://www.inazuma.jp/victory-road/fr/topics/${id}/`,
      });
    });

    // Scan directories for extra topics (e.g. found on Home but not in List)
    try {
      const dirs = fs.readdirSync(DATA_PATH).filter((f) => {
        try {
          return fs.statSync(path.join(DATA_PATH, f)).isDirectory() && /^\d+/.test(f);
        } catch {
          return false;
        }
      });

      for (const dir of dirs) {
        if (!this.topics.find((t) => t.id === dir)) {
          const metaPath = path.join(DATA_PATH, dir, "meta.json");
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
              this.topics.push(meta);
            } catch (error) {
              console.error(`Failed to load meta for ${dir}`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to scan directories", error);
    }

    // Sort by date descending
    this.topics.sort((a, b) => b.date.localeCompare(a.date));
    this.initialized = true;
    console.log(`[TopicsLib] Loaded ${this.topics.length} topics from local cache`);
  }

  public getAll(): LocalTopicSummary[] {
    return this.topics;
  }

  public getById(id: string): LocalTopicDetail | null {
    const summary = this.topics.find((t) => t.id === id);
    if (!summary) {return null;}

    const detailPath = path.join(DATA_PATH, id, "index.html");
    if (!fs.existsSync(detailPath)) {
      console.warn(`[TopicsLib] Detail file not found: ${detailPath}`);
      return null;
    }

    const html = fs.readFileSync(detailPath, "utf8");
    const $ = cheerio.load(html);

    // Remove navigation, header, footer
    $(
      "header, footer, nav, script, style, #navAreaH, #navAreaF, .langBox, .gnav, .updateBtn, .guideLink, .productBox, .bnrBox, .subLink, .bnrLink, .notes, .copyRight, .storeBtnFix, #store",
    ).remove();

    // Get the content area
    const $content = $(".contentArea");

    // Extract images and convert relative URLs to absolute
    const images: string[] = [];
    const baseUrl = `https://www.inazuma.jp/victory-road/fr/topics/${id}/`;

    $content.find("img").each((_, el) => {
      let src = $(el).attr("src");
      if (src) {
        // Convert relative paths to absolute
        if (src.startsWith("../../../")) {
          src = `https://www.inazuma.jp/victory-road/${src.replace("../../../", "")}`;
        } else if (src.startsWith("../../")) {
          src = `https://www.inazuma.jp/victory-road/fr/${src.replace("../../", "")}`;
        } else if (src.startsWith("../")) {
          src = `https://www.inazuma.jp/victory-road/fr/topics/${src.replace("../", "")}`;
        } else if (!src.startsWith("http")) {
          src = baseUrl + src;
        }
        $(el).attr("src", src);
        images.push(src);
      }
    });

    // Get thumbnail from first image in content
    const thumbnail = images.length > 0 ? images[0] : null;

    return {
      ...summary,
      content_html: $content.html() || "",
      images,
      thumbnail,
    };
  }

  public search(query: string): LocalTopicSummary[] {
    if (!query) {return this.topics;}
    const q = query.toLowerCase();
    return this.topics.filter((t) => t.title.toLowerCase().includes(q) || t.id.includes(q));
  }

  public getRecent(limit: number = 10): LocalTopicSummary[] {
    return this.topics.slice(0, limit);
  }
}

export const topicsLib = new TopicsLibrary();

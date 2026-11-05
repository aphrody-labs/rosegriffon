// Heuristic copy check for French UI text: broken values, placeholders, garbled names,
// untranslated English UI strings and stock "AI-sounding" French phrasing.

export interface CopyHit {
  kind: "broken" | "placeholder" | "garbled" | "mojibake" | "english" | "ai-tone";
  match: string;
  context: string;
}

const RULES: Array<{ kind: CopyHit["kind"]; re: RegExp }> = [
  { kind: "broken", re: /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b(?= ?[·|,:)])|\{\{[^}]*\}\}|\$\{[^}]*\}/g },
  { kind: "placeholder", re: /lorem ipsum|dolor sit amet|\bTODO\b|\bFIXME\b|\bTBD\b|\bà compléter\b|\bplaceholder\b|XXX+/gi },
  // Same capitalised word twice in a row ("Jim Jim"), excluding known intentional doubles.
  { kind: "garbled", re: /\b(\p{Lu}[\p{Ll}]{1,})\s+\1\b/gu },
  { kind: "mojibake", re: /Ã[©¨ª«ŽÊ ]|â€[™œ\u009d“”]|Â[ «»]|�/g },
  {
    kind: "english",
    re: /\b(Read more|Learn more|See all|View all|See more|Show more|Load more|Sign in|Sign up|Log in|Log out|Loading\.{0,3}|Submit|No results|Coming soon|Click here|Get started|Welcome|Back to|Settings|Search\.{0,3}|Previous|Next page|Share|Upcoming|Leaderboard|Players|Matches|Teams|Rank(?:ing)?s?|Season|Winner|Points|Copy link|Not found|Something went wrong|Try again|Close|Open menu|Skip to content)\b/g,
  },
  {
    kind: "ai-tone",
    re: /plongez|n['’]hésitez pas|incontournable|au c(?:œ|oe)ur de|que vous soyez|il est important de noter|dans un monde|embarquez|laissez-vous|expérience unique|sans précédent|révolutionn\w*|façonn\w+|tapisserie|véritable(?:s)? (?:pilier|joyau|trésor)|riche et (?:varié|diversifié)|à la croisée|en constante évolution|un voyage|bien plus qu['’]un|découvrez dès maintenant|ne manquez pas|vibrant\w*|passionnant\w* univers|l['’]aventure commence|pensé pour vous|en un clin d['’]œil/gi,
  },
];

const ALLOWED_DOUBLES = new Set(["Bora", "Tom", "Ping", "Pom", "Dum"]);

export function copyCheck(text: string, attrs: string[]): CopyHit[] {
  const hits: CopyHit[] = [];
  const seen = new Set<string>();
  const scan = (src: string, inAttr: boolean) => {
    const flat = src.replace(/\s+/g, " ");
    for (const { kind, re } of RULES) {
      re.lastIndex = 0;
      for (const m of flat.matchAll(re)) {
        if (kind === "garbled" && ALLOWED_DOUBLES.has(m[1]!)) continue;
        if (kind === "english" && inAttr && /^(Close|Search|Share)$/.test(m[0])) continue;
        const key = `${kind}:${m[0].toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const i = m.index ?? 0;
        hits.push({ kind, match: m[0], context: flat.slice(Math.max(0, i - 50), i + m[0].length + 50).trim() });
      }
    }
  };
  scan(text, false);
  for (const a of attrs) scan(a, true);
  // Em dash density is a common machine-copy tell in French UI text.
  const dashes = (text.match(/ — /g) ?? []).length;
  if (dashes >= 6) hits.push({ kind: "ai-tone", match: `${dashes} em dashes`, context: "high em dash density" });
  return hits;
}

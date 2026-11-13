// Emit the VRFW side of the Rose Griffon theme from theme.json (scripts/theme.ts):
//   content/themes/rose_griffon.toml                         VRFW.theme/1: menu palette + accents from the md3 roles
//   content/images/menu/50_title/rg_title_art.toml           VRFW.image/1: title logo from the theme's `title` slot
//   content/images/menu/50_title/title_art/logo.png          the logo fitted to the retail logo02 box (1600 x 1200)
//   content/images/menu/50_title/rg_wallpaper.toml           VRFW.image/1: mode-menu background from the `wallpaper` slot
//   content/images/menu/50_title/title_art/rg_wallpaper.png  the wallpaper fitted to the retail bg_title02_02 texture
// Sources: theme.json (Rose Griffon's published packages: @rosegriffon/ui md3 roles, @rosegriffon/assets files) and the
// real game: the pack inventory (which menu folders exist, which pack holds an atlas) and, for the wallpaper, the
// background texture size and layer placement read from the user's install (NIE_GAME_DIR) with bunre. No colour is
// computed here and no game byte is written into the mod: only VRFW declarations and PNGs made from Rose Griffon files.
//
// Pet `hello` emote: not emitted. The mode menu's only picture slots are the avatar and team banners (title02_11,
// title02_10), and their figure area is filled at run time (attach points _avatar_dmy01..03 / myteam_dmy01 with the
// masks avatar_msk01/02, myteam_msk01); avatar_base03 is the silhouette variant of a banner drawn at the same place as
// avatar_base02. No static companion slot exists there, so the emote is not forced in.
//
//   bun mods/RoseGriffon/scripts/vrfw_emit.ts <theme.json> [ievr-inventory.sqlite]
// Env: NIE_GAME_DIR (game install; without it the wallpaper is skipped), BUNRE (default target/release/bunre.exe).
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const here = dirname(import.meta.path);
const modRoot = resolve(here, "..");
const repoRoot = resolve(modRoot, "..", "..");
const themeJson = resolve(
  process.argv[2] ?? join(repoRoot, "var", "ie-work", "rg-build", "theme.json"),
);
const inventory = resolve(
  process.argv[3] ??
    join(repoRoot, "var", "ie-inventory", "ievr-inventory.sqlite"),
);
const bunre =
  process.env.BUNRE ?? join(repoRoot, "target", "release", "bunre.exe");
const gameDir = process.env.NIE_GAME_DIR;
const probeDir = join(repoRoot, "var", "ie-work", "rg-build", "game");

type Asset =
  | { name: string; path: string | null; from: "package" | "cdn" | "missing" }
  | null
  | undefined;
const t = await Bun.file(themeJson).json();
const s = t.scheme as Record<string, string>;
const role = (r: string) => {
  if (!s[r]) throw new Error(`theme.json: no md3 role "${r}"`);
  return s[r];
};
const file = (a: Asset) =>
  a && a.from !== "missing" && a.path ? a.path : null;

const db = new Database(inventory, { readonly: true });
const present = (folder: string) =>
  (db
    .query("SELECT 1 FROM entry WHERE path LIKE ? LIMIT 1")
    .get(`data/${folder}/%`) ?? null) !== null;
if (!present("dx11/menu"))
  throw new Error(
    `${inventory}: no dx11/menu entries; run var/ie-inventory/inventory.ts first`,
  );

const run = (cmd: string[]) => {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0)
    throw new Error(
      `${cmd[0]} ${cmd[1]} ${cmd[2] ?? ""}: ${p.stderr.toString().trim()}`,
    );
  return p.stdout.toString();
};
const magick = (...args: string[]) => run(["magick", ...args]);

/** A member of the real game's packs, extracted once under var/ie-work/rg-build/game and inspected with bunre. */
function gameInspect(member: string) {
  const row = db
    .query("SELECT pack FROM entry WHERE path = ? LIMIT 1")
    .get(member) as { pack: string } | null;
  if (!row)
    throw new Error(
      `${member}: not in the game packs (inventory ${inventory})`,
    );
  const pack = join(gameDir!, "data", "packs", row.pack);
  if (!existsSync(pack))
    throw new Error(`${pack}: pack missing from the install`);
  const out = join(probeDir, basename(member));
  mkdirSync(probeDir, { recursive: true });
  if (!existsSync(out))
    run([bunre, "formats", "cpk-extract", pack, member, out]);
  return JSON.parse(run([bunre, "formats", "inspect", out])).data;
}

// Minimal TOML writer for the value shapes used here.
const v = (x: unknown): string =>
  typeof x === "string"
    ? JSON.stringify(x)
    : typeof x === "number" || typeof x === "boolean"
      ? String(x)
      : Array.isArray(x)
        ? `[${x.map(v).join(", ")}]`
        : `{ ${Object.entries(x as object)
            .map(([k, y]) => `${k} = ${v(y)}`)
            .join(", ")} }`;
const table = (name: string, obj: Record<string, unknown>) =>
  `[${name}]\n${Object.entries(obj)
    .map(([k, y]) => `${k} = ${v(y)}`)
    .join("\n")}\n`;

const titleDir = join(modRoot, "content", "images", "menu", "50_title");
const artDir = join(titleDir, "title_art");
mkdirSync(artDir, { recursive: true });

// ---- mode-menu wallpaper ------------------------------------------------------------------------------------------
// title_menu_2 background (data/common/.../title02_00.g4pkm): _bg_title01 = bg_title02_01 (12 x 12 flat base, stretched),
// _bg_title02 = bg_title02_02 (the full-screen picture layer), then the edge glows bg_title02 and the particles
// bg_title02_par above it. The wallpaper replaces bg_title02_02 at its retail size; the layer's bind pose gives the part
// of it the 1920 x 1080 screen shows, where the picture is placed.
const WALL = {
  texture: "data/dx11/menu/50_title/title02/title02_00/title02_00.g4tx",
  layout: "data/common/menu/50_title/title02/title02_00/title02_00.g4pkm",
  name: "bg_title02_02",
  bone: "_bg_title02",
  atlas: "#/menu/50_title/title02/title02_00/title02_00.g4tx",
  screen: [1920, 1080],
};
const wallpaper = file(t.assets?.wallpaper);
let wallInfo = "no";
if (!wallpaper) {
  console.warn(
    `no wallpaper: theme.json assets.wallpaper is ${t.assets?.wallpaper?.from ?? "absent"}`,
  );
} else if (!gameDir) {
  console.warn(
    "no wallpaper: set NIE_GAME_DIR to read the retail background size from the game",
  );
} else {
  const tex = gameInspect(WALL.texture).textures.find(
    (x: { name: string }) => x.name === WALL.name,
  );
  const pose = gameInspect(WALL.layout).world_pose_by_name?.[WALL.bone];
  if (!tex || !pose)
    throw new Error(
      `${WALL.texture}: no ${WALL.name} texture or ${WALL.bone} layer`,
    );
  const [W, H] = [tex.width as number, tex.height as number];
  if (pose.scale_x !== W || pose.scale_y !== H)
    throw new Error(
      `${WALL.bone}: drawn ${pose.scale_x}x${pose.scale_y}, texture ${W}x${H}`,
    );
  // Visible window inside the texture (top-left convention: x, -y).
  const [vx, vy] = [-pose.x, pose.y];
  const [sw, sh] = WALL.screen;
  const out = join(artDir, "rg_wallpaper.png");
  const [fw, fh] = magick(wallpaper, "-format", "%w %h", "info:")
    .trim()
    .split(" ")
    .map(Number);
  const figH = sh; // full screen height, feet on the bottom edge
  const figW = Math.round((fw * figH) / fh);
  const figX = vx + sw - figW - Math.round(sw * 0.04); // right side, 4 % margin
  magick(
    "-size",
    `${W}x${H}`,
    `gradient:${role("surface")}-${role("primaryContainer")}`,
    "(",
    wallpaper,
    "-resize",
    `x${figH}`,
    ")",
    "-geometry",
    `+${figX}+${vy + sh - figH}`,
    "-composite",
    "-alpha",
    "off",
    "-depth",
    "8",
    out,
  );
  const recipe = [
    `schema = "VRFW.image/1"`,
    `# GENERATED by mods/RoseGriffon/scripts/vrfw_emit.ts from theme.json (${t.id}); do not edit.`,
    `# Mode-menu background: texture ${WALL.name} of title02_00 (${W} x ${H}, layer ${WALL.bone} drawn at ${pose.x}, ${pose.y}:`,
    `# the ${sw} x ${sh} screen shows ${vx}..${vx + sw} x ${vy}..${vy + sh} of it). Picture: the theme's wallpaper slot`,
    `# (${t.assets.wallpaper.name}) at screen height on the right, over a ${role("surface")} -> ${role("primaryContainer")} gradient`,
    `# (md3 surface -> primaryContainer). Opaque, so the flat retail base bg_title02_01 under it no longer shows; the`,
    `# retail edge glows (bg_title02) and particles (bg_title02_par) stay on top.`,
    "",
    `[[texture]]\natlas = ${v(WALL.atlas)}\nname = ${v(WALL.name)}\nrecipe = "rg_wallpaper"\n`,
    `[[recipe]]\nname = "rg_wallpaper"\npng = "title_art/rg_wallpaper.png"\nops = [{ op = "resize", size = [${W}, ${H}] }, { op = "opaque" }]\n`,
  ].join("\n");
  await Bun.write(join(titleDir, "rg_wallpaper.toml"), recipe);
  wallInfo = `${W}x${H}`;
}

// ---- menu theme ---------------------------------------------------------------------------------------------------
// Menu folders from the real game: everything under dx11/menu is recoloured except these folders of pictures (icons,
// illustrations, minimaps, maps, gallery, title key art, and the mode-menu background once the wallpaper replaces it).
// Each must exist in the packs.
const KEEP_COLOURS = [
  "dx11/menu/200_icon",
  "dx11/menu/220_img",
  "dx11/menu/210_minimap",
  "dx11/menu/13_map",
  "dx11/menu/90_map",
  "dx11/menu/112_gallery",
  "dx11/menu/50_title/title00",
  ...(wallInfo !== "no" ? ["dx11/menu/50_title/title02/title02_00"] : []),
];
const exclude = KEEP_COLOURS.filter(present);
for (const f of KEEP_COLOURS.filter((f) => !exclude.includes(f)))
  console.warn(`not in the game packs, skipped: ${f}`);

// Accents: the md3 role families of the Rose Griffon theme, labelled by role.
const ROLE_LABEL = {
  primary: { en: "main", fr: "principale" },
  secondary: { en: "secondary", fr: "secondaire" },
  tertiary: { en: "tertiary", fr: "tertiaire" },
};
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
const accents = (["primary", "secondary", "tertiary"] as const).map((r, i) => ({
  id: `rg_${r}`,
  value: 11 + i, // 11..13: values 1..3 of the ui_theme row are VRFW's dark theme accents (one shared row)
  text: `ui_theme_rg_${r}`,
  name: {
    en: `${t.title} (${ROLE_LABEL[r].en})`,
    fr: `${t.title} (${ROLE_LABEL[r].fr})`,
  },
  accent: role(r),
  accent_hi: role(`${r}Container`),
  accent_dark: role(`on${cap(r)}Container`),
}));

const themeToml = [
  `schema = "VRFW.theme/1"`,
  `# GENERATED by mods/RoseGriffon/scripts/vrfw_emit.ts from theme.toml (${t.id}); do not edit. Change the Rose Griffon theme instead.`,
  `# Colours: @rosegriffon/ui md3 roles. include / exclude: menu folders of the real game packs (var/ie-inventory);`,
  `# recolour rules: framework defaults.`,
  "",
  table("theme", {
    id: "rose_griffon",
    name: { en: `${t.title} (${t.name})`, fr: `${t.title} (${t.name})` },
    include: ["dx11/menu"],
    exclude,
  }),
  table("palette", {
    bg: role("surfaceDim"),
    panel: role("surfaceContainerLow"),
    card: role("surfaceContainer"),
    card_sel: role("surfaceContainerHighest"),
    border: role("outlineVariant"),
    text: role("onSurface"),
    text2: role("onSurfaceVariant"),
    key: role("surfaceContainerHigh"),
  }),
  ...accents.map(
    (a) =>
      `[[accent]]\n${Object.entries(a)
        .map(([k, y]) => `${k} = ${v(y)}`)
        .join("\n")}\n`,
  ),
].join("\n");
db.close();

const themesDir = join(modRoot, "content", "themes");
mkdirSync(themesDir, { recursive: true });
await Bun.write(join(themesDir, "rose_griffon.toml"), themeToml);

// ---- title logo ---------------------------------------------------------------------------------------------------
// Fit the theme's title asset into the retail logo02 box, transparent padding.
const titleAsset = file(t.assets?.title) ? t.assets.title : t.assets?.logo;
const title = file(titleAsset);
if (title) {
  magick(
    title,
    "-resize",
    "1500x1100",
    "-background",
    "none",
    "-gravity",
    "center",
    "-extent",
    "1600x1200",
    join(artDir, "logo.png"),
  );
  const ATLASES = [
    "#/menu/50_title/title00/title00_03_02/<LG>/title00_03_02.g4tx", // press-start logo
    "#/menu/50_title/title02/title02_01/<LG>/title02_01.g4tx", // mode-menu logo
  ];
  const recipe = [
    `schema = "VRFW.image/1"`,
    `# GENERATED by mods/RoseGriffon/scripts/vrfw_emit.ts: the theme's title slot (${titleAsset.name}) on`,
    `# the press-start and mode-menu logo, every language. Needs config.toml [VRFW.TitleArt] own = true.`,
    "",
    ...ATLASES.flatMap((atlas) =>
      ["", ["de", "es", "en", "fr", "it", "pt", "zh_hans", "zh_hant"]].map(
        (lang) =>
          `[[sprite]]\natlas = ${v(atlas)}\nname = "logo02"\npng = "title_art/logo.png"\nlang = ${v(lang)}\n`,
      ),
    ),
  ].join("\n");
  await Bun.write(join(titleDir, "rg_title_art.toml"), recipe);
}

console.log(
  `VRFW theme rose_griffon: palette bg ${role("surfaceDim")} card ${role("surfaceContainer")} text ${role("onSurface")}; ` +
    `${accents.length} accents; title ${title ? "yes" : "no"}; wallpaper ${wallInfo}; pet emote: no static menu slot`,
);

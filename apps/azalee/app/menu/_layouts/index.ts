// Registre des écrans de menu IEVR disponibles dans azalee.
//
// Chaque `<screen>.json` est un layout exporté par `iecode menu export <screen>`
// (IECODE.Core/Cdn/MenuLayoutExporter — arbre OBJB + transforms G4PKM + sprites G4TX).
// Les sprites sont servis EN LIVE depuis les CPK via le CDN
// (`NEXT_PUBLIC_MENU_ASSET_BASE` = `https://cdn.rosegriffon.fr/g4tx`, pngUrl `/dx11/menu/...png`).
//
// Régénérer : `iecode menu export <screen> -l fr -o <dir>` puis déposer le JSON ici
// (le nom de fichier = l'id d'écran de l'URL `/menu/<screen>`).

import type { MenuLayout } from "@rose-griffon/menu-render-webgpu";
import s_00_soccer from "./00_soccer.json" with { type: "json" };
import s_01_rpg from "./01_rpg.json" with { type: "json" };
import s_02_btl from "./02_btl.json" with { type: "json" };
import s_100_mainmenu from "./100_mainmenu.json" with { type: "json" };
import s_102_team from "./102_team.json" with { type: "json" };
import s_103_item from "./103_item.json" with { type: "json" };
import s_104_bookmark from "./104_bookmark.json" with { type: "json" };
import s_105_datafile from "./105_datafile.json" with { type: "json" };
import s_106_info from "./106_info.json" with { type: "json" };
import s_107_vs from "./107_vs.json" with { type: "json" };
import s_108_option from "./108_option.json" with { type: "json" };
import s_109_system from "./109_system.json" with { type: "json" };
import s_10_win from "./10_win.json" with { type: "json" };
import s_110_playguide from "./110_playguide.json" with { type: "json" };
import s_112_gallery from "./112_gallery.json" with { type: "json" };
import s_113_activity from "./113_activity.json" with { type: "json" };
import s_115_calendar from "./115_calendar.json" with { type: "json" };
import s_121_inacord from "./121_inacord.json" with { type: "json" };
import s_122_opponent from "./122_opponent.json" with { type: "json" };
import s_150_shop from "./150_shop.json" with { type: "json" };
import s_160_town from "./160_town.json" with { type: "json" };
import s_161_avatar from "./161_avatar.json" with { type: "json" };
import s_20_cmn from "./20_cmn.json" with { type: "json" };
import s_30_vsroute from "./30_vsroute.json" with { type: "json" };
import s_31_universe from "./31_universe.json" with { type: "json" };
import s_50_title from "./50_title.json" with { type: "json" };
import s_51_save from "./51_save.json" with { type: "json" };
import s_55_information from "./55_information.json" with { type: "json" };
import s_600_event from "./600_event.json" with { type: "json" };
import s_60_story from "./60_story.json" with { type: "json" };
import s_90_map from "./90_map.json" with { type: "json" };
import s_91_quest from "./91_quest.json" with { type: "json" };

/** Écrans de menu disponibles, indexés par identifiant (= dossier `dx11/menu/<screen>`). */
export const MENU_SCREENS: Record<string, MenuLayout> = {
	"00_soccer": s_00_soccer as unknown as MenuLayout,
	"01_rpg": s_01_rpg as unknown as MenuLayout,
	"02_btl": s_02_btl as unknown as MenuLayout,
	"100_mainmenu": s_100_mainmenu as unknown as MenuLayout,
	"102_team": s_102_team as unknown as MenuLayout,
	"103_item": s_103_item as unknown as MenuLayout,
	"104_bookmark": s_104_bookmark as unknown as MenuLayout,
	"105_datafile": s_105_datafile as unknown as MenuLayout,
	"106_info": s_106_info as unknown as MenuLayout,
	"107_vs": s_107_vs as unknown as MenuLayout,
	"108_option": s_108_option as unknown as MenuLayout,
	"109_system": s_109_system as unknown as MenuLayout,
	"10_win": s_10_win as unknown as MenuLayout,
	"110_playguide": s_110_playguide as unknown as MenuLayout,
	"112_gallery": s_112_gallery as unknown as MenuLayout,
	"113_activity": s_113_activity as unknown as MenuLayout,
	"115_calendar": s_115_calendar as unknown as MenuLayout,
	"121_inacord": s_121_inacord as unknown as MenuLayout,
	"122_opponent": s_122_opponent as unknown as MenuLayout,
	"150_shop": s_150_shop as unknown as MenuLayout,
	"160_town": s_160_town as unknown as MenuLayout,
	"161_avatar": s_161_avatar as unknown as MenuLayout,
	"20_cmn": s_20_cmn as unknown as MenuLayout,
	"30_vsroute": s_30_vsroute as unknown as MenuLayout,
	"31_universe": s_31_universe as unknown as MenuLayout,
	"50_title": s_50_title as unknown as MenuLayout,
	"51_save": s_51_save as unknown as MenuLayout,
	"55_information": s_55_information as unknown as MenuLayout,
	"600_event": s_600_event as unknown as MenuLayout,
	"60_story": s_60_story as unknown as MenuLayout,
	"90_map": s_90_map as unknown as MenuLayout,
	"91_quest": s_91_quest as unknown as MenuLayout,
};

/** Identifiants d'écrans disponibles (pour `generateStaticParams`). */
export const MENU_SCREEN_IDS: readonly string[] = Object.keys(MENU_SCREENS);

/** Renvoie le layout d'un écran, ou `null` si inconnu. */
export function getMenuLayout(screen: string): MenuLayout | null {
	return MENU_SCREENS[screen] ?? null;
}

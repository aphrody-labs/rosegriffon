//! Rendu CPU des écrans du jeu : [`Frame`] (cadre RGBA + helpers), [`Font`] (police réelle via
//! `LatinAtlas`), [`render_state`] (un état → un cadre) et [`CpuRenderer`] (impl [`Renderer`] :
//! police + toiles de fond 3D pré-rendues). Front-end headless/golden ; le temps-réel passe par wgpu.

#[cfg(not(target_arch = "wasm32"))]
use std::path::Path;

use anyhow::{Context, Result};
use aphrody_nie_formats::font::{self, LatinAtlas};
use aphrody_nie_formats::{cfgbin, g4tx};
use aphrody_nie_runtime::open_world::{ElementBadge, OpenWorldState, ProximityAction, WorldZoneId};
use aphrody_nie_ui::{color, surfaces};

use crate::GameState;
#[cfg(not(target_arch = "wasm32"))]
use crate::Renderer;
#[cfg(not(target_arch = "wasm32"))]
use crate::character;

/// Largeur du canevas de rendu (px).
pub const W: usize = 1280;
/// Hauteur du canevas de rendu (px).
pub const H: usize = 720;

/// Atlas de police chargé (octets + `LatinAtlas` + largeur), pour le rendu de texte.
pub struct Font {
    atlas: Vec<u8>,
    la: LatinAtlas,
    aw: usize,
}

/// Repli ASCII d'un caractère que l'atlas latin ne porte pas.
///
/// **Pis-aller assumé, et voici pourquoi.** L'atlas `font_def` ne contient pas les lettres
/// accentuées : sa rangée latine est l'ASCII imprimable (0x21..0x7E) suivi de quinze katakana
/// demi-chasse — vérifié en extrayant les pixels, pas supposé. Les métriques de `font.cfg.bin`
/// connaissent pourtant les 38 caractères français (sous leurs octets UTF-8 empaquetés,
/// cf. `FontMetrics::glyph_char`), mais leurs coordonnées pointent, DANS CET ATLAS, sur des
/// idéogrammes : elles décrivent une autre planche. Retrouver la bonne est un travail de
/// rétro-ingénierie, pas une correction de deux lignes.
///
/// En attendant, sans repli, le moteur dessinait une espace : « Composition d' quipe »,
/// « Fichier de donn es ». Un mot amputé ne se lit pas ; un mot sans accent se lit. On dégrade
/// donc de façon lisible et prévisible, plutôt que de laisser des trous ou — pire — de blitter
/// le glyphe que les métriques désignent, qui est un idéogramme.
fn repli_ascii(c: char) -> Option<&'static str> {
    Some(match c {
        'é' | 'è' | 'ê' | 'ë' => "e",
        'à' | 'â' | 'ä' => "a",
        'î' | 'ï' => "i",
        'ô' | 'ö' => "o",
        'ù' | 'û' | 'ü' => "u",
        'ç' => "c",
        'É' | 'È' | 'Ê' | 'Ë' => "E",
        'À' | 'Â' | 'Ä' => "A",
        'Î' | 'Ï' => "I",
        'Ô' | 'Ö' => "O",
        'Ù' | 'Û' | 'Ü' => "U",
        'Ç' => "C",
        'œ' => "oe",
        'Œ' => "OE",
        'æ' => "ae",
        'Æ' => "AE",
        // Ponctuation française : les guillemets et l'apostrophe typographique ont un
        // équivalent ASCII exact, il n'y a rien à perdre à les convertir.
        '«' | '»' => "\"",
        '’' | '‘' => "'",
        '…' => "...",
        '–' | '—' => "-",
        // Séparateurs typographiques : sans repli, ils disparaissaient et deux champs se
        // retrouvaient collés par une espace (« Milieu   Foret » au lieu de « Milieu · Foret »).
        '·' | '•' => "-",
        '×' => "x",
        '°' => "o",
        _ => return None,
    })
}

impl Font {
    /// Construit la police depuis les OCTETS de `font.cfg.bin` (métriques) + `font.g4tx` (atlas).
    /// Cœur wasm-safe (aucune I/O) : l'appelant fournit les octets (fichier natif ou fetch web).
    pub fn from_bytes(cfg_bytes: &[u8], g4tx_bytes: &[u8]) -> Result<Self> {
        let cfg = cfgbin::parse_t2b(cfg_bytes).map_err(|e| anyhow::anyhow!("cfg: {e:?}"))?;
        let metrics = font::parse_metrics(&cfg);
        let tx = g4tx::parse(g4tx_bytes).map_err(|e| anyhow::anyhow!("g4tx: {e:?}"))?;
        let t = tx.textures.first().context("pas de texture police")?;
        let dds = &g4tx_bytes[t.data_offset..];
        let off = if dds.len() >= 88 && &dds[84..88] == b"DX10" {
            148
        } else {
            128
        };
        let atlas = dds[off..].to_vec();
        let (aw, ah) = (t.width as usize, t.height as usize);
        let la = LatinAtlas::from_atlas(&atlas, aw, ah, 946, metrics.dims.cell_height);
        Ok(Self { atlas, la, aw })
    }
}

impl Default for Font {
    fn default() -> Self {
        Self {
            atlas: vec![0; 64 * 64 * 4],
            la: LatinAtlas {
                spans: Vec::new(),
                y_base: 0,
                cell_h: 24,
                ink_top: 0,
                ink_h: 24,
            },
            aw: 64,
        }
    }
}

impl Font {
    /// Largeur d'un texte en pixels, telle qu'il sera dessiné (replis ASCII compris).
    #[must_use]
    pub fn largeur(&self, texte: &str) -> u32 {
        self.la.measure(&self.texte_rendu(texte))
    }

    /// Texte rendu tel qu'il sera réellement dessiné : les caractères absents de l'atlas latin
    /// sont remplacés par leur équivalent ASCII (cf. [`repli_ascii`]).
    ///
    /// Mesure et dessin passent par ici tous les deux — sinon un libellé accentué serait centré
    /// sur une largeur qu'il n'occupe pas.
    fn texte_rendu(&self, texte: &str) -> String {
        texte
            .chars()
            .map(|c| {
                if c == ' ' || self.la.span(c as u32).is_some() {
                    c.to_string()
                } else {
                    repli_ascii(c).unwrap_or(" ").to_string()
                }
            })
            .collect()
    }

    /// Dessine `texte` à `(x, y)` sur `canvas` (RGBA8, `cw` px de large).
    ///
    /// `y` désigne le haut de l'**encre**, pas le haut de la cellule : une cellule de `font_def`
    /// porte 21 px de vide au-dessus des lettres, et une mise en page qui l'ignore décale tout
    /// son texte vers le bas.
    fn dessiner(&self, canvas: &mut [u8], cw: usize, x: i32, y: i32, texte: &str, fg: [u8; 4]) {
        let rendu = self.texte_rendu(texte);
        let y_cellule = y - i32::from(self.la.ink_top);
        self.la
            .blit_line(&self.atlas, self.aw, canvas, cw, x, y_cellule, &rendu, fg);
    }

    /// Tronque `texte` pour qu'il tienne dans `max_px`, en terminant par « … » s'il a été coupé.
    ///
    /// Les données du jeu ne sont pas calibrées pour une largeur d'écran : une entrée de
    /// « Fichier de données » est une phrase entière, et sans coupe elle sort du cadre par la
    /// droite — la fin du mot est perdue sans que rien ne l'indique. Mieux vaut une ellipse, qui
    /// dit qu'il y a une suite.
    #[must_use]
    pub fn tronquer(&self, texte: &str, max_px: i32) -> String {
        if max_px <= 0 || self.largeur(texte) as i32 <= max_px {
            return texte.to_string();
        }
        // Réserve la place de l'ellipse avant de couper, sinon le résultat dépasse encore.
        let reserve = max_px - self.largeur("...") as i32;
        let mut coupe = String::new();
        for c in texte.chars() {
            let essai_len = {
                coupe.push(c);
                let l = self.largeur(&coupe) as i32;
                coupe.pop();
                l
            };
            if essai_len > reserve {
                break;
            }
            coupe.push(c);
        }
        // Ne pas couper en plein mot quand un espace proche permet de faire mieux.
        if let Some(pos) = coupe.rfind(' ')
            && pos > coupe.len().saturating_sub(14)
        {
            coupe.truncate(pos);
        }
        format!("{}...", coupe.trim_end())
    }

    /// Hauteur d'une ligne de texte telle qu'elle s'affiche, en pixels.
    ///
    /// C'est la hauteur à réserver dans une mise en page — la cellule complète en gaspillerait
    /// un tiers, et neuf lignes n'entreraient pas dans l'écran.
    #[must_use]
    pub fn hauteur_ligne(&self) -> i32 {
        i32::from(self.la.ink_h)
    }

    /// Charge la police depuis le disque (natif) — délègue à [`Font::from_bytes`].
    #[cfg(not(target_arch = "wasm32"))]
    pub fn load(cfg_path: &Path, g4tx_path: &Path) -> Result<Self> {
        Self::from_bytes(&std::fs::read(cfg_path)?, &std::fs::read(g4tx_path)?)
    }
}

/// Cadre de rendu RGBA + helpers de dessin.
pub struct Frame<'a> {
    /// Tampon RGBA8 `W*H*4`.
    pub buf: Vec<u8>,
    f: &'a Font,
}

/// Transparent framebuffer used for screens whose verified pixels are owned by the front end.
///
/// The reconstructed main-menu image and its measured interaction geometry live outside this
/// generic CPU prototype. Returning an empty surface prevents this crate from drawing a second,
/// invented menu while preserving the fixed framebuffer ABI expected by existing callers.
#[allow(dead_code)]
pub fn host_owned_surface() -> Vec<u8> {
    vec![0; W * H * 4]
}

impl<'a> Frame<'a> {
    fn new(f: &'a Font) -> Self {
        Self {
            buf: vec![0u8; W * H * 4],
            f,
        }
    }
    /// Cadre initialisé depuis une frame RGBA existante (ex. rendu 3D du perso en toile de fond).
    fn from_base(f: &'a Font, base: &[u8]) -> Self {
        let mut buf = vec![0u8; W * H * 4];
        if base.len() == buf.len() {
            buf.copy_from_slice(base);
        }
        Self { buf, f }
    }
    fn gradient(&mut self, top: [u8; 3], bot: [u8; 3]) {
        for y in 0..H {
            let t = y as f32 / H as f32;
            let mix = |a: u8, b: u8| (f32::from(a) * (1.0 - t) + f32::from(b) * t) as u8;
            let c = [
                mix(top[0], bot[0]),
                mix(top[1], bot[1]),
                mix(top[2], bot[2]),
                255,
            ];
            for x in 0..W {
                let o = (y * W + x) * 4;
                self.buf[o..o + 4].copy_from_slice(&c);
            }
        }
    }
    #[allow(clippy::needless_range_loop)] // blend RGBA : indices explicites (c[k] + buf[o+k]).
    fn rect(&mut self, x0: i32, y0: i32, x1: i32, y1: i32, c: [u8; 4]) {
        let a = f32::from(c[3]) / 255.0;
        for y in y0.max(0)..y1.min(H as i32) {
            for x in x0.max(0)..x1.min(W as i32) {
                let o = (y as usize * W + x as usize) * 4;
                for k in 0..3 {
                    self.buf[o + k] =
                        (f32::from(c[k]) * a + f32::from(self.buf[o + k]) * (1.0 - a)) as u8;
                }
                self.buf[o + 3] = 255;
            }
        }
    }
    fn text(&mut self, x: i32, y: i32, s: &str, color: [u8; 4]) {
        self.f.dessiner(&mut self.buf, W, x, y, s, color);
    }
    fn text_centered(&mut self, y: i32, s: &str, color: [u8; 4]) {
        let w = self.f.largeur(s) as i32;
        self.text((W as i32 - w) / 2, y, s, color);
    }
    /// Texte avec retour à la ligne par mot dans `max_w` (px). Interligne `line_h`.
    fn text_wrapped(&mut self, x: i32, y: i32, max_w: i32, line_h: i32, s: &str, color: [u8; 4]) {
        let (mut line, mut row) = (String::new(), 0i32);
        for word in s.split_whitespace() {
            let trial = if line.is_empty() {
                word.to_string()
            } else {
                format!("{line} {word}")
            };
            if self.f.largeur(&trial) as i32 > max_w && !line.is_empty() {
                self.text(x, y + row * line_h, &line, color);
                row += 1;
                line = word.to_string();
            } else {
                line = trial;
            }
        }
        if !line.is_empty() {
            self.text(x, y + row * line_h, &line, color);
        }
    }
}

/// Rend un état du jeu dans un cadre. `bg` = toile de fond 3D propre à cet état (perso, match…).
#[must_use]
pub fn render_state<'a>(state: &GameState, f: &'a Font, bg: Option<&[u8]>) -> Frame<'a> {
    let mut s = match bg {
        Some(b) => Frame::from_base(f, b),
        None => Frame::new(f),
    };
    match state {
        GameState::Title => {
            s.gradient([24, 32, 64], [8, 10, 20]);
            s.text_centered(250, "INAZUMA ELEVEN", [235, 240, 255, 255]);
            s.text_centered(330, "VICTORY ROAD", [120, 200, 255, 255]);
            s.text_centered(560, "PRESS START", [200, 210, 230, 255]);
        }
        GameState::MainMenu { sel } => return render_main_menu(*sel, f),
        GameState::Match { home, away } => {
            if bg.is_none() {
                s.gradient([18, 60, 30], [8, 24, 14]);
            }
            s.rect(0, 0, W as i32, 70, [20, 60, 130, 255]);
            s.text(40, 16, "MATCH RESULT", [220, 235, 255, 255]);
            s.text_centered(280, "RAIMON", [255, 240, 180, 255]);
            s.text_centered(380, &format!("{home}  -  {away}"), [255, 255, 255, 255]);
            s.text_centered(480, "ROYAL ACADEMY", [200, 210, 255, 255]);
            let verdict = if home > away {
                "RAIMON WINS!"
            } else if home < away {
                "DEFEAT..."
            } else {
                "DRAW"
            };
            s.text_centered(600, verdict, [120, 255, 160, 255]);
        }
        GameState::Story { speaker, line } => {
            if bg.is_none() {
                s.gradient([20, 26, 54], [8, 10, 22]);
            }
            let (bx0, bx1) = (60i32, W as i32 - 60);
            let by1 = H as i32 - 40;
            let by0 = by1 - 150;
            s.rect(bx0, by0, bx1, by1, [10, 14, 28, 224]);
            s.rect(bx0, by0, bx1, by0 + 3, [90, 200, 255, 255]);
            s.rect(bx0 + 20, by0 - 40, bx0 + 280, by0 + 2, [30, 60, 110, 235]);
            s.text(bx0 + 36, by0 - 32, speaker, [200, 235, 255, 255]);
            s.text_wrapped(
                bx0 + 40,
                by0 + 28,
                bx1 - bx0 - 80,
                46,
                line,
                [240, 244, 250, 255],
            );
        }
    }
    s
}

/// Marge gauche du texte dans une barre de liste, en pixels.
const TEXTE_X: i32 = 110;

/// Compose le bandeau de score par-dessus une image de match.
///
/// Le rastériseur du moteur (`aphrody_nie_runtime::render`) n'a pas de police : il rend le score par deux
/// barres dont la longueur est proportionnelle aux buts, ce qui se lit mal dès le deuxième but et
/// pas du tout au premier coup d'œil. La police vit ici, donc le bandeau aussi.
///
/// `temps` est le temps de jeu simulé, en secondes.
#[must_use]
pub fn hud_match(base: &[u8], f: &Font, score: [u32; 2], temps: f32) -> Vec<u8> {
    let mut s = Frame::from_base(f, base);
    let ligne = f.hauteur_ligne();
    let h_bandeau = ligne + 18;
    s.rect(0, 0, W as i32, h_bandeau, [12, 18, 38, 205]);

    let minutes = (temps / 60.0) as u32;
    let secondes = (temps % 60.0) as u32;
    let gauche = format!("DOMICILE {}", score[0]);
    let droite = format!("{} EXTERIEUR", score[1]);
    let chrono = format!("{minutes:02}:{secondes:02}");

    let y = (h_bandeau - ligne) / 2;
    s.text(24, y, &gauche, [140, 190, 255, 255]);
    let w_chrono = f.largeur(&chrono) as i32;
    s.text((W as i32 - w_chrono) / 2, y, &chrono, [235, 240, 250, 255]);
    let w_droite = f.largeur(&droite) as i32;
    s.text(W as i32 - 24 - w_droite, y, &droite, [255, 170, 170, 255]);
    s.buf
}

/// Descriptions textuelles de chaque onglet du menu principal pour la prévisualisation.
pub const MENU_DESCRIPTIONS: [&str; 9] = [
    "Gestion de la formation, placement des joueurs et tactiques d'équipe.",
    "Inventaire des objets, équipements, techniques et consommables.",
    "Marque-pages d'informations, profils favoris et repères de progression.",
    "Réseau Inacord : messagerie, liens entre joueurs et activités de club.",
    "Fichier de données encyclopédique du football d'Inazuma Eleven.",
    "Sélection des adversaires et accès aux 5 modes de jeu principaux.",
    "Guide du jeu, didacticiels et explications des règles de match.",
    "Paramètres système, affichage, audio et commandes de jeu.",
    "Sauvegarde de la progression sur le système de fichiers virtuel.",
];

/// Rend le menu principal complet avec la liste des 9 onglets, la carte d'aperçu du mode sélectionné
/// et la barre de commandes de navigation. Utilisable en headless, natif et wasm.
#[must_use]
pub fn render_main_menu<'a>(sel: usize, f: &'a Font) -> Frame<'a> {
    let mut s = Frame::new(f);
    // Fond dégradé élégant Victory Road
    s.gradient([18, 28, 58], [10, 14, 28]);

    // Barre supérieure de titre
    s.rect(0, 0, W as i32, 64, [16, 48, 110, 240]);
    s.rect(0, 62, W as i32, 64, [60, 180, 255, 255]);
    s.text(
        32,
        14,
        "INAZUMA ELEVEN : VICTORY ROAD",
        [230, 242, 255, 255],
    );
    s.text(W as i32 - 280, 14, "MENU PRINCIPAL", [120, 200, 255, 255]);

    // Panneau gauche : les 9 onglets réels du jeu
    let left_w = 480i32;
    let n = crate::MENU.len();
    let ligne = f.hauteur_ligne();
    let haut_liste = 84;
    let dispo = H as i32 - haut_liste - 54;
    let gap = dispo / n as i32;
    let bh = gap - 6;

    for (i, &item) in crate::MENU.iter().enumerate() {
        let y = haut_liste + i as i32 * gap;
        let hot = i == sel;
        let bg_c = if hot {
            [40, 110, 200, 245]
        } else {
            [16, 24, 46, 210]
        };
        s.rect(32, y, left_w, y + bh, bg_c);
        if hot {
            s.rect(32, y, 40, y + bh, [100, 220, 255, 255]);
            s.rect(left_w - 4, y, left_w, y + bh, [100, 220, 255, 255]);
        }
        let txt = f.tronquer(item, left_w - 64);
        let color = if hot {
            [255, 255, 255, 255]
        } else {
            [190, 205, 225, 255]
        };
        s.text(52, y + (bh - ligne) / 2, &txt, color);
    }

    // Panneau droit : carte d'aperçu / prévisualisation de l'onglet actif
    let right_x = left_w + 24;
    let right_w = W as i32 - 32 - right_x;
    let right_top = 84;
    let right_bot = H as i32 - 54;
    s.rect(
        right_x,
        right_top,
        right_x + right_w,
        right_bot,
        [14, 22, 42, 230],
    );
    s.rect(
        right_x,
        right_top,
        right_x + right_w,
        right_top + 4,
        [60, 160, 240, 255],
    );

    // Titre de l'onglet actif dans la carte
    let active_title = crate::MENU.get(sel).copied().unwrap_or("MENU");
    s.text(
        right_x + 24,
        right_top + 24,
        active_title,
        [240, 245, 255, 255],
    );

    // Description de l'onglet
    let desc = MENU_DESCRIPTIONS.get(sel).copied().unwrap_or("");
    s.text_wrapped(
        right_x + 24,
        right_top + 70,
        right_w - 48,
        36,
        desc,
        [180, 200, 230, 255],
    );

    // Si on est sur "Adversaires" (sel == 5), afficher les 5 modes disponibles
    if sel == 5 {
        s.text(
            right_x + 24,
            right_top + 160,
            "MODES DISPONIBLES :",
            [100, 210, 255, 255],
        );
        for (m_idx, &mode) in crate::MODES.iter().enumerate() {
            let my = right_top + 200 + m_idx as i32 * 38;
            s.rect(
                right_x + 24,
                my,
                right_x + right_w - 24,
                my + 30,
                [20, 32, 60, 200],
            );
            s.rect(right_x + 24, my, right_x + 28, my + 30, [80, 160, 230, 255]);
            s.text(
                right_x + 36,
                my + (30 - ligne) / 2,
                mode,
                [220, 235, 250, 255],
            );
        }
    } else {
        // Décoration d'aperçu générique
        s.rect(
            right_x + 24,
            right_top + 160,
            right_x + right_w - 24,
            right_bot - 24,
            [10, 16, 32, 180],
        );
        let center_x = right_x + right_w / 2;
        let lbl1 = "VFS / LEVEL-5 SYSTEM ENGINE";
        let w1 = f.largeur(lbl1) as i32;
        s.text(
            center_x - w1 / 2,
            right_top + 240,
            lbl1,
            [70, 110, 170, 255],
        );
        let lbl2 = "Composant operationnel - Ready";
        let w2 = f.largeur(lbl2) as i32;
        s.text(
            center_x - w2 / 2,
            right_top + 280,
            lbl2,
            [100, 170, 230, 255],
        );
    }

    // Barre inférieure d'aide / commandes
    s.rect(0, H as i32 - 40, W as i32, H as i32, [10, 16, 32, 240]);
    s.text(
        32,
        H as i32 - 30,
        "[Fleches / ZQSD] Naviguer   [Entree] Valider   [Echap] Ecran-titre",
        [140, 170, 210, 255],
    );

    s
}

/// Rendu générique d'un menu-liste (titre + items surlignables), adapté au nombre d'items.
///
/// Sert au menu principal (9 onglets réels), au sélecteur de mode (5 modes réels) et aux listes
/// de données du jeu. RGBA8 `W*H*4`.
#[must_use]
pub fn render_list<'a>(title: &str, items: &[&str], sel: usize, f: &'a Font) -> Frame<'a> {
    let mut s = Frame::new(f);
    s.gradient([30, 40, 80], [14, 18, 34]);
    s.rect(0, 0, W as i32, 70, [20, 60, 130, 255]);
    s.text(40, 16, title, [220, 235, 255, 255]);
    // La mise en page part de la hauteur RÉELLE d'une ligne de texte, mesurée dans l'atlas — pas
    // d'une constante. Avec neuf onglets, une supposition trop généreuse déborde de l'écran (le
    // dernier libellé était coupé) et une supposition trop courte fait sortir le texte de sa
    // barre (c'était le cas : cellule de 71 px pour une boîte de 57).
    let n = (items.len().max(1)) as i32;
    let ligne = f.hauteur_ligne();
    let haut_liste = 100;
    let dispo = H as i32 - haut_liste - 20;
    let gap = (dispo / n).clamp(ligne + 8, ligne + 40);
    let bh = gap - 8;
    for (i, item) in items.iter().enumerate() {
        let y = haut_liste + i as i32 * gap;
        let hot = i == sel;
        let bg_c = if hot {
            [60, 130, 220, 235]
        } else {
            [16, 22, 44, 210]
        };
        s.rect(70, y, W as i32 - 70, y + bh, bg_c);
        if hot {
            s.rect(70, y, 76, y + bh, [120, 220, 255, 255]);
        }
        // Encre centrée dans la barre : `text` prend le haut de l'encre, donc le calcul est
        // direct et ne dépend plus de la hauteur de cellule.
        let coupe = f.tronquer(item, W as i32 - 70 - TEXTE_X - 16);
        s.text(TEXTE_X, y + (bh - ligne) / 2, &coupe, [240, 245, 252, 255]);
    }
    s
}

fn screen_color_rgba(c: &surfaces::ScreenColor, alpha: u8) -> [u8; 4] {
    let hex = c.hex.strip_prefix('#').unwrap_or(c.hex);
    if hex.len() >= 6 {
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
        [r, g, b, alpha]
    } else {
        [0, 0, 0, alpha]
    }
}

fn badge_color(badge: ElementBadge) -> [u8; 4] {
    match badge {
        ElementBadge::Wind => screen_color_rgba(&surfaces::CHIP_WIND, 255),
        ElementBadge::Fire => screen_color_rgba(&surfaces::CHIP_FIRE, 255),
        ElementBadge::Forest => screen_color_rgba(&surfaces::CHIP_FOREST, 255),
        ElementBadge::Mountain => screen_color_rgba(&surfaces::CHIP_MOUNTAIN, 255),
    }
}

/// Rend la scène open world / Kizuna Town en CPU framebuffer RGBA8 1280x720.
#[must_use]
pub fn render_open_world<'a>(world: &OpenWorldState, f: &'a Font) -> Frame<'a> {
    let mut s = Frame::new(f);

    // Authentic design system tokens from aphrody_nie_ui::surfaces
    let col_header_blue = screen_color_rgba(&surfaces::HEADER_BLUE, 255);
    let col_header_deep = screen_color_rgba(&surfaces::HEADER_BLUE_DEEP, 255);
    let col_cyan = screen_color_rgba(&surfaces::SELECTION_CYAN, 255);
    let col_btn_primary = screen_color_rgba(&surfaces::BUTTON_PRIMARY, 255);
    let col_tile_deep = screen_color_rgba(&surfaces::TILE_DEEP, 240);
    let col_tile_bevel = screen_color_rgba(&surfaces::TILE_BEVEL, 255);

    // Reference color module for token palette consistency
    let _ = color::ColorToken::css_line;

    let horizon_y = 260i32;

    // 1. Sky & horizon gradient
    let (sky_top, sky_bot): ([u8; 3], [u8; 3]) = match world.zone {
        WorldZoneId::Nagumohara => ([14, 28, 56], [32, 64, 112]),
        WorldZoneId::Raimon => ([12, 26, 44], [26, 68, 92]),
        WorldZoneId::KizunaTown => ([22, 18, 50], [58, 44, 102]),
        WorldZoneId::OdaibaStadium => ([10, 16, 36], [24, 46, 86]),
    };
    for y in 0..horizon_y {
        let t = y as f32 / horizon_y as f32;
        let c = [
            (f32::from(sky_top[0]) * (1.0 - t) + f32::from(sky_bot[0]) * t) as u8,
            (f32::from(sky_top[1]) * (1.0 - t) + f32::from(sky_bot[1]) * t) as u8,
            (f32::from(sky_top[2]) * (1.0 - t) + f32::from(sky_bot[2]) * t) as u8,
            255,
        ];
        s.rect(0, y, W as i32, y + 1, c);
    }

    // 2. Ground with zone perspective grid
    let (ground_top, ground_bot): ([u8; 3], [u8; 3]) = match world.zone {
        WorldZoneId::Nagumohara => ([18, 32, 60], [8, 14, 30]),
        WorldZoneId::Raimon => ([16, 36, 48], [6, 18, 26]),
        WorldZoneId::KizunaTown => ([24, 22, 54], [10, 10, 26]),
        WorldZoneId::OdaibaStadium => ([16, 26, 48], [6, 12, 24]),
    };
    for y in horizon_y..(H as i32) {
        let t = (y - horizon_y) as f32 / (H as i32 - horizon_y) as f32;
        let c = [
            (f32::from(ground_top[0]) * (1.0 - t) + f32::from(ground_bot[0]) * t) as u8,
            (f32::from(ground_top[1]) * (1.0 - t) + f32::from(ground_bot[1]) * t) as u8,
            (f32::from(ground_top[2]) * (1.0 - t) + f32::from(ground_bot[2]) * t) as u8,
            255,
        ];
        s.rect(0, y, W as i32, y + 1, c);
    }

    // Horizon line
    s.rect(0, horizon_y - 2, W as i32, horizon_y + 1, col_tile_bevel);

    // Perspective grid: vanishing point at center horizon
    let (vx, vy) = (W as i32 / 2, horizon_y);
    for y in horizon_y..(H as i32) {
        let t = (y - vy) as f32 / (H as i32 - vy) as f32;
        for i in -12..=12 {
            let x = (vx as f32 + (i as f32 * 85.0) * t) as i32;
            if x >= 0 && x < W as i32 {
                let o = (y as usize * W + x as usize) * 4;
                s.buf[o] = s.buf[o].saturating_add(col_tile_bevel[0] / 3);
                s.buf[o + 1] = s.buf[o + 1].saturating_add(col_tile_bevel[1] / 3);
                s.buf[o + 2] = s.buf[o + 2].saturating_add(col_tile_bevel[2] / 3);
            }
        }
    }
    // Transverse lines
    for k in 1..=8 {
        let t = (k as f32 / 8.0).powf(1.8);
        let ly = horizon_y + ((H as i32 - horizon_y) as f32 * t) as i32;
        s.rect(
            0,
            ly,
            W as i32,
            ly + 1,
            [col_tile_bevel[0], col_tile_bevel[1], col_tile_bevel[2], 120],
        );
    }

    // 3. 3D entity projection (camera-relative)
    let (sin_y, cos_y) = (world.camera.yaw.sin(), world.camera.yaw.cos());

    // Kizuna Town sockets and monuments
    if world.zone == WorldZoneId::KizunaTown {
        for placement in &world.kizuna.placements {
            let dx = placement.pos.x - world.player.position.x;
            let dz = placement.pos.z - world.player.position.z;
            let cam_x = dx * cos_y - dz * sin_y;
            let cam_z = dx * sin_y + dz * cos_y;
            let z_proj = cam_z + 11.0;
            if z_proj > 2.0 {
                let sx = (640.0 + (cam_x / z_proj) * 800.0) as i32;
                let sy = (500.0 - (cam_z / (z_proj + 5.0)) * 600.0) as i32;
                if sx > 40 && sx < (W as i32 - 40) && sy > (horizon_y + 10) && sy < (H as i32 - 40)
                {
                    s.rect(sx - 24, sy - 10, sx + 24, sy + 10, col_tile_deep);
                    s.rect(sx - 22, sy - 8, sx + 22, sy + 8, col_tile_bevel);
                    s.rect(sx - 18, sy - 6, sx + 18, sy + 6, col_cyan);
                    let tag = format!("Socle #{}", placement.object_id);
                    let tw = f.largeur(&tag) as i32;
                    s.text(sx - tw / 2, sy - 30, &tag, col_cyan);
                }
            }
        }
        // Kizuna Town HUD status card
        s.rect(24, 76, 320, 116, col_tile_deep);
        s.rect(24, 76, 28, 116, col_cyan);
        let kiz_txt = format!(
            "KIZUNA : {} pts | {} PO",
            world.kizuna.kizuna_power, world.kizuna.kizuna_coins
        );
        s.text(38, 88, &kiz_txt, [255, 230, 120, 255]);
    }

    // NPCs with element affinity chips
    for npc in &world.npcs {
        let dx = npc.ctrl.position.x - world.player.position.x;
        let dz = npc.ctrl.position.z - world.player.position.z;
        let cam_x = dx * cos_y - dz * sin_y;
        let cam_z = dx * sin_y + dz * cos_y;
        let z_proj = cam_z + 11.0;
        if z_proj > 2.0 {
            let sx = (640.0 + (cam_x / z_proj) * 800.0) as i32;
            let sy = (500.0 - (cam_z / (z_proj + 5.0)) * 600.0) as i32;
            if sx > 60 && sx < (W as i32 - 60) && sy > (horizon_y + 10) && sy < (H as i32 - 40) {
                let elem_c = badge_color(npc.element);
                s.rect(sx - 14, sy - 14, sx + 14, sy + 14, col_tile_deep);
                s.rect(sx - 12, sy - 12, sx + 12, sy + 12, elem_c);

                let elem_label = match npc.element {
                    ElementBadge::Wind => "VENT",
                    ElementBadge::Fire => "FEU",
                    ElementBadge::Forest => "BOIS",
                    ElementBadge::Mountain => "TERRE",
                };
                let label = format!("{} [{}]", npc.name, elem_label);
                let lw = f.largeur(&label) as i32;
                s.rect(
                    sx - lw / 2 - 6,
                    sy - 38,
                    sx + lw / 2 + 6,
                    sy - 16,
                    [10, 16, 36, 230],
                );
                s.rect(sx - lw / 2 - 6, sy - 18, sx + lw / 2 + 6, sy - 16, elem_c);
                s.text(sx - lw / 2, sy - 35, &label, [240, 248, 255, 255]);
            }
        }
    }

    // Player marker & directional arrow at center-bottom
    let px_screen = 640;
    let py_screen = 500;
    s.rect(
        px_screen - 14,
        py_screen - 14,
        px_screen + 14,
        py_screen + 14,
        col_tile_deep,
    );
    s.rect(
        px_screen - 12,
        py_screen - 12,
        px_screen + 12,
        py_screen + 12,
        col_btn_primary,
    );

    let pdir_x = (world.player.direction.x * 16.0) as i32;
    let pdir_z = (world.player.direction.z * 16.0) as i32;
    s.rect(
        px_screen + pdir_x - 3,
        py_screen - pdir_z - 3,
        px_screen + pdir_x + 3,
        py_screen - pdir_z + 3,
        col_cyan,
    );

    let pw = f.largeur(&world.leader_name) as i32;
    s.rect(
        px_screen - pw / 2 - 6,
        py_screen - 38,
        px_screen + pw / 2 + 6,
        py_screen - 16,
        [10, 20, 42, 220],
    );
    s.rect(
        px_screen - pw / 2 - 6,
        py_screen - 18,
        px_screen + pw / 2 + 6,
        py_screen - 16,
        col_cyan,
    );
    s.text(
        px_screen - pw / 2,
        py_screen - 35,
        &world.leader_name,
        [255, 255, 255, 255],
    );

    // 4. Skewed header banner (-10 deg angle)
    for y in 12..68 {
        let dy = y - 12;
        let x_skew = (dy as f32 * 0.1763) as i32;
        let bx0 = 24 + x_skew;
        let bx1 = 980 + x_skew;
        s.rect(bx0, y, bx1, y + 1, col_header_blue);
        if ((bx0 + y * 2) / 16) % 2 == 0 {
            s.rect(bx0, y, bx1, y + 1, col_header_deep);
        }
    }
    s.rect(24, 12, 980, 14, col_cyan);
    s.rect(34, 66, 990, 68, col_tile_bevel);

    s.text(50, 20, world.zone.title_fr(), [255, 255, 255, 255]);
    let leader_info = format!("Chef : {}   Nv. {}", world.leader_name, world.party_level);
    s.text(50, 44, &leader_info, [210, 235, 255, 255]);
    let match_info = format!("Victoires : {}", world.matches_won);
    s.text(420, 44, &match_info, col_cyan);
    let phase_info = format!("Phase : {:?}", world.phase);
    s.text(620, 44, &phase_info, [180, 210, 245, 255]);

    // 5. Top-right minimap radar
    let rx0 = W as i32 - 190;
    let ry0 = 16;
    let rw = 170;
    let rh = 170;
    let rx1 = rx0 + rw;
    let ry1 = ry0 + rh;
    s.rect(rx0, ry0, rx1, ry1, col_tile_deep);
    s.rect(rx0, ry0, rx1, ry0 + 3, col_cyan);
    s.rect(rx0, ry1 - 3, rx1, ry1, col_tile_bevel);
    s.rect(rx0, ry0, rx0 + 3, ry1, col_tile_bevel);
    s.rect(rx1 - 3, ry0, rx1, ry1, col_cyan);

    s.text(rx0 + 10, ry0 + 6, "RADAR ZONE", [180, 220, 255, 255]);
    let rcx = rx0 + rw / 2;
    let rcy = ry0 + rh / 2 + 10;
    s.rect(rx0 + 12, rcy, rx1 - 12, rcy + 1, [40, 80, 140, 180]);
    s.rect(rcx, ry0 + 26, rcx + 1, ry1 - 12, [40, 80, 140, 180]);

    let (hw, hd) = world.zone.half_extents();
    let scale = 60.0;
    for npc in &world.npcs {
        let nx = rcx + ((npc.ctrl.position.x / hw) * scale) as i32;
        let ny = rcy - ((npc.ctrl.position.z / hd) * scale) as i32;
        if nx >= rx0 + 4 && nx <= rx1 - 4 && ny >= ry0 + 20 && ny <= ry1 - 4 {
            let ec = badge_color(npc.element);
            s.rect(nx - 2, ny - 2, nx + 3, ny + 3, ec);
        }
    }
    let p_dot_x = rcx + ((world.player.position.x / hw) * scale) as i32;
    let p_dot_y = rcy - ((world.player.position.z / hd) * scale) as i32;
    if p_dot_x >= rx0 + 4 && p_dot_x <= rx1 - 4 && p_dot_y >= ry0 + 20 && p_dot_y <= ry1 - 4 {
        s.rect(p_dot_x - 3, p_dot_y - 3, p_dot_x + 4, p_dot_y + 4, col_cyan);
    }

    // 6. Bottom-right proximity prompt badge when world.active_prompt() is present
    if let Some(prompt) = world.active_prompt() {
        let (prompt_title, prompt_desc) = match prompt {
            ProximityAction::TalkNpc {
                speaker,
                triggers_battle,
                ..
            } => {
                if triggers_battle {
                    ("MATCH", format!("Defier {speaker} en match"))
                } else {
                    ("PARLER", format!("Discuter avec {speaker}"))
                }
            }
            ProximityAction::ZoneTransition { label, .. } => {
                ("VOYAGE", format!("Prendre le train vers {label}"))
            }
            ProximityAction::StartBattle { opponent_name } => {
                ("DEFI", format!("Affronter {opponent_name}"))
            }
            ProximityAction::KizunaCustomize { socket_id } => {
                ("KIZUNA", format!("Amenager le Socle #{socket_id}"))
            }
        };
        let bx1 = W as i32 - 32;
        let bx0 = bx1 - 380;
        let by1 = H as i32 - 36;
        let by0 = by1 - 56;
        for y in by0..by1 {
            let skew = ((y - by0) as f32 * 0.1763) as i32;
            s.rect(bx0 + skew, y, bx1 + skew, y + 1, col_tile_deep);
        }
        s.rect(bx0, by0, bx0 + 6, by1, col_cyan);
        s.rect(bx0 + 14, by0 + 12, bx0 + 84, by1 - 12, col_btn_primary);
        let key_w = f.largeur("ENTREE") as i32;
        s.text(
            bx0 + 14 + (70 - key_w) / 2,
            by0 + 18,
            "ENTREE",
            [255, 255, 255, 255],
        );
        s.text(bx0 + 96, by0 + 12, prompt_title, col_cyan);
        let desc_cut = f.tronquer(&prompt_desc, 260);
        s.text(bx0 + 96, by0 + 32, &desc_cut, [230, 240, 255, 255]);
    }

    // 7. Lower dialogue panel when world.active_dialogue is active
    if let Some((npc_idx, line_idx)) = world.active_dialogue
        && let Some(npc) = world.npcs.get(npc_idx)
        && let Some(line) = npc.dialogue.get(line_idx)
    {
        let dx0 = 60;
        let dx1 = W as i32 - 60;
        let dy1 = H as i32 - 40;
        let dy0 = dy1 - 150;

        s.rect(dx0, dy0, dx1, dy1, [10, 16, 32, 245]);
        s.rect(dx0, dy0, dx1, dy0 + 3, col_cyan);
        s.rect(dx0, dy1 - 3, dx1, dy1, col_tile_bevel);

        let elem_c = badge_color(npc.element);
        let name_w = f.largeur(&npc.name) as i32 + 80;
        s.rect(
            dx0 + 20,
            dy0 - 36,
            dx0 + 20 + name_w,
            dy0 + 2,
            col_tile_deep,
        );
        s.rect(dx0 + 20, dy0 - 36, dx0 + 24, dy0 + 2, elem_c);
        s.rect(dx0 + 28, dy0 - 26, dx0 + 40, dy0 - 14, elem_c);
        s.text(dx0 + 46, dy0 - 28, &npc.name, [255, 255, 255, 255]);

        s.text_wrapped(
            dx0 + 36,
            dy0 + 26,
            dx1 - dx0 - 72,
            38,
            line,
            [245, 250, 255, 255],
        );

        let prog = format!(
            "{}/{}  [ENTREE] Continuer",
            line_idx + 1,
            npc.dialogue.len()
        );
        let pw = f.largeur(&prog) as i32;
        s.text(dx1 - pw - 30, dy1 - 28, &prog, col_cyan);
    }

    // 8. Bottom help bar
    s.rect(0, H as i32 - 24, W as i32, H as i32, [8, 12, 24, 230]);
    s.text(
        24,
        H as i32 - 18,
        "[Fleches / ZQSD] Se deplacer   [Entree] Interagir   [Echap] Menu",
        [140, 170, 210, 255],
    );

    s
}

/// Chemins des assets d'un personnage 3D (toile de fond menu/histoire). Natif (chemins disque).
#[cfg(not(target_arch = "wasm32"))]
pub struct CharAssets<'a> {
    pub md: &'a Path,
    pub mg: &'a Path,
    pub sk: &'a Path,
    pub tex: &'a Path,
}

/// Renderer CPU : police + toiles de fond 3D pré-rendues (perso, scène match), réutilisées par état.
/// Natif (charge les assets depuis le disque) ; le rendu web passe par [`render_state`] + [`Font::from_bytes`].
#[cfg(not(target_arch = "wasm32"))]
pub struct CpuRenderer {
    font: Font,
    char_bg: Option<Vec<u8>>,
    match_bg: Option<Vec<u8>>,
}

#[cfg(not(target_arch = "wasm32"))]
impl CpuRenderer {
    /// Construit le renderer : charge la police et, si `chr` fourni, pré-rend le perso 3D + la scène
    /// de match (réutilisés comme toiles de fond).
    pub fn new(font_cfg: &Path, font_g4tx: &Path, chr: Option<CharAssets<'_>>) -> Result<Self> {
        let font = Font::load(font_cfg, font_g4tx).context("chargement police")?;
        let (char_bg, match_bg) = match chr {
            Some(c) => {
                let model = character::build_skinned_model(
                    &std::fs::read(c.md)?,
                    &std::fs::read(c.mg)?,
                    &std::fs::read(c.sk)?,
                    &std::fs::read(c.tex)?,
                )
                .context("chargement perso 3D")?;
                let cbg = character::render_character(
                    &model,
                    W as u32,
                    H as u32,
                    0.55,
                    [30, 40, 80],
                    [12, 16, 30],
                );
                let mbg = character::render_match_scene(&model, W as u32, H as u32);
                (Some(cbg), Some(mbg))
            }
            None => (None, None),
        };
        Ok(Self {
            font,
            char_bg,
            match_bg,
        })
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl Renderer for CpuRenderer {
    fn render(&self, state: &GameState) -> Vec<u8> {
        let bg = match state {
            GameState::Match { .. } => self.match_bg.as_deref(),
            GameState::MainMenu { .. } | GameState::Story { .. } => self.char_bg.as_deref(),
            GameState::Title => None,
        };
        render_state(state, &self.font, bg).buf
    }
}

#[cfg(test)]
mod tests {
    use super::repli_ascii;

    /// Tout caractère du français que l'atlas latin ne porte pas doit avoir un repli ASCII.
    ///
    /// Sans repli, le rendu écrit une espace : « Fichier de donn es ». Le jeu est en français —
    /// les neuf onglets du menu principal, les cinq modes et les dialogues en sont pleins.
    #[test]
    fn tout_le_francais_a_un_repli() {
        // Les caractères réellement produits par les textes du jeu, minuscules et majuscules,
        // plus la ponctuation typographique française.
        for c in "éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇœŒæÆ«»’…–—·•×°".chars()
        {
            assert!(repli_ascii(c).is_some(), "aucun repli pour « {c} »");
        }
    }

    /// Le repli conserve la lettre, il ne l'invente pas : `é` donne `e`, jamais autre chose.
    #[test]
    fn le_repli_garde_la_lettre_de_base() {
        assert_eq!(repli_ascii('é'), Some("e"));
        assert_eq!(repli_ascii('È'), Some("E"));
        assert_eq!(repli_ascii('ç'), Some("c"));
        assert_eq!(repli_ascii('œ'), Some("oe"));
        assert_eq!(repli_ascii('«'), Some("\""));
        assert_eq!(repli_ascii('’'), Some("'"));
    }

    /// L'ASCII n'a rien à voir avec ce mécanisme : il est rendu par l'atlas, pas replié.
    ///
    /// Un repli qui capturerait l'ASCII masquerait une régression de l'edge-scan — le texte
    /// continuerait de s'afficher alors que la police ne serait plus lue.
    #[test]
    fn l_ascii_n_est_pas_replie() {
        for c in "AZaz09 !?,.-'\"".chars() {
            assert_eq!(
                repli_ascii(c),
                None,
                "« {c} » ne doit pas passer par le repli"
            );
        }
    }

    #[test]
    fn menu_descriptions_correspondent_aux_neuf_onglets() {
        assert_eq!(super::MENU_DESCRIPTIONS.len(), crate::MENU.len());
        for desc in &super::MENU_DESCRIPTIONS {
            assert!(!desc.is_empty());
        }
    }

    #[test]
    fn render_open_world_generates_valid_rgba_frame() {
        let font = super::Font::default();
        let nagumo = super::OpenWorldState::new(super::WorldZoneId::Nagumohara);
        let frame_nagumo = super::render_open_world(&nagumo, &font);
        assert_eq!(frame_nagumo.buf.len(), super::W * super::H * 4);
        // Ensure buffer is not empty (contains rendered sky, grid, banner)
        assert!(frame_nagumo.buf.iter().any(|&b| b > 0));

        let kizuna = super::OpenWorldState::new(super::WorldZoneId::KizunaTown);
        let frame_kizuna = super::render_open_world(&kizuna, &font);
        assert_eq!(frame_kizuna.buf.len(), super::W * super::H * 4);
        assert!(frame_kizuna.buf.iter().any(|&b| b > 0));
    }
}

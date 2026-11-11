//! IEVR G4TX atlas regions exposed as deterministic CSS sprite classes.

use aphrody_nie_formats::g4tx::G4tx;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModeCss {
    Image,
    Masque,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Sprite {
    pub nom: String,
    pub classe: String,
    pub x: i32,
    pub y: i32,
    pub largeur: i32,
    pub hauteur: i32,
}

#[derive(Debug, Clone)]
pub struct SpriteSheet {
    pub nom: String,
    pub largeur: i32,
    pub hauteur: i32,
    pub sprites: Vec<Sprite>,
}

#[must_use]
pub fn depuis_g4tx(g4tx: &G4tx, index_texture: usize) -> Option<SpriteSheet> {
    let texture = g4tx.textures.get(index_texture)?;
    let sprites = texture
        .sub_textures
        .iter()
        .map(|region| Sprite {
            nom: region.name.clone(),
            classe: assainir_nom(&region.name),
            x: i32::from(region.x),
            y: i32::from(region.y),
            largeur: i32::from(region.width),
            hauteur: i32::from(region.height),
        })
        .collect();
    Some(SpriteSheet {
        nom: texture.name.clone(),
        largeur: i32::try_from(texture.width).ok()?,
        hauteur: i32::try_from(texture.height).ok()?,
        sprites,
    })
}

fn assainir_nom(name: &str) -> String {
    let mut sanitized = String::with_capacity(name.len());
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
            sanitized.push(ch.to_ascii_lowercase());
        } else {
            sanitized.push('-');
        }
    }
    if sanitized.is_empty() {
        return "sprite".to_owned();
    }
    if sanitized.starts_with(|ch: char| ch.is_ascii_digit()) {
        sanitized.insert(0, 's');
    }
    sanitized
}

fn escape_css_url(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\a ")
        .replace('\r', "\\d ")
        .replace('\0', "")
}

impl SpriteSheet {
    #[must_use]
    pub fn vers_css_mode(&self, image_url: &str, mode: ModeCss) -> String {
        let url = escape_css_url(image_url);
        let mut css = format!(
            "/* {} — {} regions, atlas {}x{}. */\n",
            self.nom,
            self.sprites.len(),
            self.largeur,
            self.hauteur
        );
        match mode {
            ModeCss::Image => css.push_str(&format!(
                ".nie-sprite {{ display:inline-block; background-image:url(\"{url}\"); background-repeat:no-repeat; background-size:{}px {}px; image-rendering:pixelated; }}\n",
                self.largeur, self.hauteur
            )),
            ModeCss::Masque => css.push_str(&format!(
                ".nie-sprite {{ display:inline-block; background-color:currentColor; -webkit-mask-image:url(\"{url}\"); mask-image:url(\"{url}\"); -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-size:{}px {}px; mask-size:{}px {}px; }}\n",
                self.largeur, self.hauteur, self.largeur, self.hauteur
            )),
        }
        for sprite in &self.sprites {
            match mode {
                ModeCss::Image => css.push_str(&format!(
                    ".nie-{} {{ width:{}px; height:{}px; background-position:{}px {}px; }}\n",
                    sprite.classe, sprite.largeur, sprite.hauteur, -sprite.x, -sprite.y
                )),
                ModeCss::Masque => css.push_str(&format!(
                    ".nie-{} {{ width:{}px; height:{}px; -webkit-mask-position:{}px {}px; mask-position:{}px {}px; }}\n",
                    sprite.classe, sprite.largeur, sprite.hauteur, -sprite.x, -sprite.y, -sprite.x, -sprite.y
                )),
            }
        }
        css
    }
}

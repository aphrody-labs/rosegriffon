//! Atlas d'icônes du jeu → feuille de sprites exploitable sur le web.
//!
//! Les `.g4tx` d'interface ne sont pas des images simples : ce sont des **atlas**. Le conteneur
//! décrit lui-même ses régions ([`crate::g4tx::G4txSubTexture`] : nom + rectangle), et le jeu les
//! adresse au runtime par `SetIconSprite(obj, CRC32(chemin), CRC32(région))`. `gaiji_game.g4tx`
//! en compte 117.

use crate::g4tx::G4tx;
use alloc::string::String;
use alloc::vec::Vec;

pub const PREFIXE: &str = "ievr";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModeCss {
    Image,
    Masque,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Sprite {
    pub nom: String,
    pub classe: String,
    pub x: i32,
    pub y: i32,
    pub largeur: i32,
    pub hauteur: i32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct SpriteSheet {
    pub nom: String,
    pub largeur: u32,
    pub hauteur: u32,
    pub sprites: Vec<Sprite>,
}

#[must_use]
pub fn assainir_nom(nom: &str) -> String {
    nom.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

#[must_use]
pub fn data_uri(mime: &str, bytes: &[u8]) -> String {
    #[cfg(feature = "std")]
    {
        use base64::Engine as _;
        let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
        alloc::format!("data:{mime};base64,{encoded}")
    }
    #[cfg(not(feature = "std"))]
    {
        let _ = bytes;
        alloc::format!("data:{mime};base64,")
    }
}

/// Extrait la feuille de sprites d'un atlas déjà parsé.
#[must_use]
pub fn depuis_g4tx(g4tx: &G4tx, index_texture: usize) -> Option<SpriteSheet> {
    let t = g4tx.textures.get(index_texture)?;
    let sprites = t
        .sub_textures
        .iter()
        .map(|s| Sprite {
            nom: s.name.clone(),
            classe: assainir_nom(&s.name),
            x: i32::from(s.x),
            y: i32::from(s.y),
            largeur: i32::from(s.width),
            hauteur: i32::from(s.height),
        })
        .collect();
    Some(SpriteSheet {
        nom: t.name.clone(),
        largeur: t.width as u32,
        hauteur: t.height as u32,
        sprites,
    })
}

impl SpriteSheet {
    #[must_use]
    pub fn len(&self) -> usize {
        self.sprites.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.sprites.is_empty()
    }

    #[must_use]
    pub fn vers_json(&self) -> String {
        #[cfg(feature = "serde")]
        {
            serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".to_string())
        }
        #[cfg(not(feature = "serde"))]
        {
            let mut s = alloc::format!(
                "{{\"nom\":\"{}\",\"largeur\":{},\"hauteur\":{},\"sprites\":[",
                self.nom,
                self.largeur,
                self.hauteur
            );
            for (i, sp) in self.sprites.iter().enumerate() {
                if i > 0 {
                    s.push(',');
                }
                s.push_str(&alloc::format!("{{\"nom\":\"{}\",\"classe\":\"{}\",\"x\":{},\"y\":{},\"largeur\":{},\"hauteur\":{}}}", sp.nom, sp.classe, sp.x, sp.y, sp.largeur, sp.hauteur));
            }
            s.push_str("]}");
            s
        }
    }

    #[must_use]
    pub fn vers_css(&self, image_url: &str) -> String {
        self.vers_css_mode(image_url, ModeCss::Image)
    }

    #[must_use]
    pub fn vers_css_mode(&self, image_url: &str, mode: ModeCss) -> String {
        let mut css = alloc::format!(
            "/* {} — {} régions, atlas {}x{}. */\n",
            self.nom,
            self.sprites.len(),
            self.largeur,
            self.hauteur
        );
        match mode {
            ModeCss::Image => {
                css.push_str(&alloc::format!(
                    ".{PREFIXE}-sprite {{ display: inline-block; background-image: url(\"{image_url}\"); background-repeat: no-repeat; background-size: {}px {}px; image-rendering: pixelated; }}\n",
                    self.largeur, self.hauteur
                ));
            }
            ModeCss::Masque => {
                css.push_str(&alloc::format!(
                    ".{PREFIXE}-sprite {{ display: inline-block; background-color: currentColor; -webkit-mask-image: url(\"{image_url}\"); mask-image: url(\"{image_url}\"); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-size: {}px {}px; mask-size: {}px {}px; }}\n",
                    self.largeur, self.hauteur, self.largeur, self.hauteur
                ));
            }
        }
        for sprite in &self.sprites {
            match mode {
                ModeCss::Image => {
                    css.push_str(&alloc::format!(
                        ".{PREFIXE}-{} {{ width: {}px; height: {}px; background-position: {}px {}px; }}\n",
                        sprite.classe, sprite.largeur, sprite.hauteur, -sprite.x, -sprite.y
                    ));
                }
                ModeCss::Masque => {
                    css.push_str(&alloc::format!(
                        ".{PREFIXE}-{} {{ width: {}px; height: {}px; -webkit-mask-position: {}px {}px; mask-position: {}px {}px; }}\n",
                        sprite.classe, sprite.largeur, sprite.hauteur, -sprite.x, -sprite.y, -sprite.x, -sprite.y
                    ));
                }
            }
        }
        css
    }

    #[must_use]
    pub fn vers_svg(&self, data_uri: &str) -> String {
        let mut svg = alloc::format!(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {} {}\">\n  <image href=\"{}\" width=\"{}\" height=\"{}\"/>\n",
            self.largeur,
            self.hauteur,
            data_uri,
            self.largeur,
            self.hauteur
        );
        for s in &self.sprites {
            svg.push_str(&alloc::format!(
                "  <g id=\"{}\" data-name=\"{}\"><rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"none\"/></g>\n",
                s.classe, s.nom, s.x, s.y, s.largeur, s.hauteur
            ));
        }
        svg.push_str("</svg>\n");
        svg
    }
}

#[cfg(test)]
mod tests {
    extern crate alloc;
    use super::*;
    use crate::g4tx::{G4txSubTexture, G4txTexture};
    use alloc::vec::Vec;

    #[test]
    fn les_regions_du_g4tx_devment_des_sprites() {
        let mut t = G4txTexture {
            id: 0,
            name: "gaiji_game".into(),
            width: 512,
            height: 256,
            is_dds: true,
            data_offset: 0,
            data_size: 0,
            sub_textures: Vec::new(),
        };
        t.sub_textures.push(G4txSubTexture {
            id: 1,
            name: "gtxt_rarity01_05".into(),
            x: 128,
            y: 64,
            width: 96,
            height: 32,
        });
        let entete = crate::g4tx::G4txHeader {
            header_size: 0x60,
            file_type: 0x65,
            table_size: 0,
            texture_count: 1,
            total_count: 2,
            sub_texture_count: 1,
            texture_data_size: 0,
        };
        let g = G4tx {
            header: entete,
            textures: alloc::vec![t],
        };

        let f = depuis_g4tx(&g, 0).expect("texture 0");
        assert_eq!(f.nom, "gaiji_game");
        assert_eq!(f.len(), 1);
        assert_eq!(f.sprites[0].x, 128);
        assert_eq!(f.sprites[0].largeur, 96);
        assert!(depuis_g4tx(&g, 9).is_none(), "index hors bornes");
    }
}

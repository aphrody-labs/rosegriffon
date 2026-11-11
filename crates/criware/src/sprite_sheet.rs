//! Atlas d'icônes du jeu → feuille de sprites exploitable sur le web.
//!
//! Les `.g4tx` d'interface ne sont pas des images simples : ce sont des **atlas**. Le conteneur
//! décrit lui-même ses régions ([`crate::g4tx::G4txSubTexture`] : nom + rectangle), et le jeu les
//! adresse au runtime par `SetIconSprite(obj, CRC32(chemin), CRC32(région))`. `gaiji_game.g4tx`
//! en compte 117.

use alloc::string::String;
use alloc::vec::Vec;
use crate::g4tx::G4tx;

pub const PREFIXE: &str = "ievr";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModeCss {
    Image,
    Masque,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sprite {
    pub nom: String,
    pub classe: String,
    pub x: i32,
    pub y: i32,
    pub largeur: i32,
    pub hauteur: i32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SpriteSheet {
    pub nom: String,
    pub largeur: u32,
    pub hauteur: u32,
    pub sprites: Vec<Sprite>,
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
}

#[must_use]
pub fn assainir_nom(nom: &str) -> String {
    nom.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

#[must_use]
pub fn data_uri(mime: &str, bytes: &[u8]) -> String {
    use base64::prelude::*;
    let encoded = BASE64_STANDARD.encode(bytes);
    alloc::format!("data:{mime};base64,{encoded}")
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
        largeur: t.width,
        hauteur: t.height,
        sprites,
    })
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

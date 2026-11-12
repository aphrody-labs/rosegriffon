//! Une image d'entrée manette, indépendante de l'hôte.
//!
//! La disposition suit le « Standard Gamepad » du W3C (`navigator.getGamepads()`, `mapping =
//! "standard"`) : seize boutons et deux sticks. C'est aussi l'ordre des actions de
//! `steam_action_manifest.vdf` une fois traduites par Steam Input, ce qui permet à un même
//! [`PadFrame`] de venir d'une manette Xbox, PlayStation, Switch Pro ou d'un Steam Deck.
//!
//! Le moteur ne lit que des **bits** : l'hôte (navigateur, fenêtre native, rejeu) remplit `held`
//! à chaque image et `pressed` pour les fronts montants. Le module ne connaît ni le DOM ni l'heure.

/// Les seize boutons du Standard Gamepad, dans l'ordre de `Gamepad.buttons`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum PadButton {
    /// Bouton sud (A Xbox, Croix PlayStation, B Switch) : valider, passe.
    South = 0,
    /// Bouton est (B Xbox, Rond, A Switch) : retour, tir.
    East = 1,
    /// Bouton ouest (X Xbox, Carré, Y Switch) : technique Hissatsu de frappe.
    West = 2,
    /// Bouton nord (Y Xbox, Triangle, X Switch) : technique Hissatsu défensive.
    North = 3,
    /// L1 / LB : changer de joueur.
    L1 = 4,
    /// R1 / RB : Zone.
    R1 = 5,
    /// L2 / LT.
    L2 = 6,
    /// R2 / RT : sprint.
    R2 = 7,
    /// Select / Back / View.
    Select = 8,
    /// Start / Menu / Options : pause.
    Start = 9,
    /// Clic du stick gauche.
    L3 = 10,
    /// Clic du stick droit.
    R3 = 11,
    /// Croix directionnelle, haut.
    DpadUp = 12,
    /// Croix directionnelle, bas.
    DpadDown = 13,
    /// Croix directionnelle, gauche.
    DpadLeft = 14,
    /// Croix directionnelle, droite.
    DpadRight = 15,
}

impl PadButton {
    /// Les seize boutons, dans l'ordre de leur index W3C.
    pub const ALL: [Self; 16] = [
        Self::South,
        Self::East,
        Self::West,
        Self::North,
        Self::L1,
        Self::R1,
        Self::L2,
        Self::R2,
        Self::Select,
        Self::Start,
        Self::L3,
        Self::R3,
        Self::DpadUp,
        Self::DpadDown,
        Self::DpadLeft,
        Self::DpadRight,
    ];

    /// Bouton d'index W3C `index`, ou `None` au-delà de quinze (bouton « Home » et extensions).
    #[must_use]
    pub fn from_index(index: usize) -> Option<Self> {
        Self::ALL.get(index).copied()
    }

    /// Masque binaire du bouton dans [`PadFrame::held`] / [`PadFrame::pressed`].
    #[must_use]
    pub const fn bit(self) -> u16 {
        1 << (self as u8)
    }
}

/// Entrée manette d'une image de simulation.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct PadFrame {
    /// Stick gauche `(x, y)`, `y` positif vers le **haut** (l'inverse de l'axe W3C), zone morte
    /// déjà appliquée par l'hôte.
    pub left: (f32, f32),
    /// Stick droit `(x, y)`, même convention.
    pub right: (f32, f32),
    /// Boutons tenus (bits [`PadButton::bit`]).
    pub held: u16,
    /// Boutons enfoncés sur cette image (front montant).
    pub pressed: u16,
    /// Boutons relâchés sur cette image (front descendant).
    pub released: u16,
}

impl PadFrame {
    /// Le bouton est-il tenu ?
    #[must_use]
    pub const fn is_held(&self, b: PadButton) -> bool {
        self.held & b.bit() != 0
    }

    /// Le bouton vient-il d'être enfoncé ?
    #[must_use]
    pub const fn just_pressed(&self, b: PadButton) -> bool {
        self.pressed & b.bit() != 0
    }

    /// Le bouton vient-il d'être relâché ?
    #[must_use]
    pub const fn just_released(&self, b: PadButton) -> bool {
        self.released & b.bit() != 0
    }

    /// Direction de déplacement : stick gauche, sinon croix directionnelle.
    ///
    /// La croix sert de repli parce qu'une partie des manettes Switch et le clavier n'ont pas de
    /// stick analogique ; les deux ne s'additionnent pas, le stick l'emporte s'il est dévié.
    #[must_use]
    pub fn movement(&self) -> (f32, f32) {
        let (x, y) = self.left;
        if x * x + y * y > 0.0 {
            return (x, y);
        }
        let axis = |neg: PadButton, pos: PadButton| -> f32 {
            f32::from(i8::from(self.is_held(pos)) - i8::from(self.is_held(neg)))
        };
        (
            axis(PadButton::DpadLeft, PadButton::DpadRight),
            axis(PadButton::DpadDown, PadButton::DpadUp),
        )
    }

    /// Image suivante quand rien ne change : les boutons restent tenus, sans front.
    #[must_use]
    pub const fn held_only(&self) -> Self {
        Self {
            left: self.left,
            right: self.right,
            held: self.held,
            pressed: 0,
            released: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn les_seize_index_w3c_sont_couverts_dans_lordre() {
        for (i, b) in PadButton::ALL.iter().enumerate() {
            assert_eq!(*b as usize, i);
            assert_eq!(PadButton::from_index(i), Some(*b));
        }
        assert_eq!(PadButton::from_index(16), None);
        let tous = PadButton::ALL.iter().fold(0u16, |m, b| m | b.bit());
        assert_eq!(tous, u16::MAX, "seize bits distincts");
    }

    #[test]
    fn le_stick_prime_sur_la_croix() {
        let mut f = PadFrame {
            held: PadButton::DpadRight.bit() | PadButton::DpadUp.bit(),
            ..PadFrame::default()
        };
        assert_eq!(f.movement(), (1.0, 1.0));
        f.left = (-0.5, 0.0);
        assert_eq!(f.movement(), (-0.5, 0.0));
    }

    #[test]
    fn held_only_efface_les_fronts() {
        let f = PadFrame {
            held: PadButton::South.bit(),
            pressed: PadButton::South.bit(),
            released: PadButton::East.bit(),
            ..PadFrame::default()
        };
        let g = f.held_only();
        assert!(g.is_held(PadButton::South));
        assert!(!g.just_pressed(PadButton::South) && !g.just_released(PadButton::East));
    }
}

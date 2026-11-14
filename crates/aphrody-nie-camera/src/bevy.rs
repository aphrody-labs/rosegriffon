//! Intégration Bevy 0.20.1 (`bevy_ecs` + `bevy_math`) pour la caméra NIE.

use bevy_ecs::prelude::Component;
use bevy_math::{Mat4, Vec3};

use crate::model::CameraState;

/// Composant ECS Bevy encapsulant l'état de caméra mesuré [`CameraState`].
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub struct NieCameraState {
    /// État natif de la caméra (`pos`, `ref_pos`, `fov_deg`, `roll_deg`, `near`, `far`).
    pub state: CameraState,
}

impl From<CameraState> for NieCameraState {
    fn from(state: CameraState) -> Self {
        Self { state }
    }
}

impl NieCameraState {
    /// Position de la caméra en [`Vec3`] Bevy.
    #[must_use]
    pub fn position(&self) -> Vec3 {
        Vec3::from_array(self.state.pos)
    }

    /// Cible regardée en [`Vec3`] Bevy.
    #[must_use]
    pub fn target(&self) -> Vec3 {
        Vec3::from_array(self.state.ref_pos)
    }

    /// Matrice vue-projection Bevy (`perspective_rh * look_at_rh`) pour un ratio `aspect`.
    #[must_use]
    #[allow(deprecated)]
    pub fn view_projection(&self, aspect: f32) -> Mat4 {
        let near = self.state.near.max(0.01);
        let far = self.state.far.max(near + 1.0);
        let fov = self.state.fov_deg.clamp(5.0, 170.0).to_radians();
        let proj = Mat4::perspective_rh(fov, aspect.max(0.01), near, far);
        let view = Mat4::look_at_rh(self.position(), self.target(), Vec3::Y);
        proj * view
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nie_camera_state_computes_finite_view_projection() {
        let mut s = CameraState::default();
        s.pos = [0.0, 5.0, 12.0];
        s.ref_pos = [0.0, 1.0, 0.0];
        let comp = NieCameraState::from(s);
        let vp = comp.view_projection(16.0 / 9.0);
        assert!(vp.is_finite());
    }
}

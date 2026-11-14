//! Intégration Bevy 0.20.1 (`App` / `Plugin` / `Resource`) pour le client WASM NIE.

use bevy_app::{App, Plugin};
use bevy_ecs::prelude::Resource;

use aphrody_nie_bevy::NieAssetPlugin;
use aphrody_nie_render3d::bevy::NieRender3dPlugin;

/// Ressource Bevy exposant les dimensions du canevas WASM.
#[derive(Resource, Debug, Clone, Copy, PartialEq, Eq)]
pub struct WasmViewport {
    /// Largeur du canevas (px).
    pub width: u32,
    /// Hauteur du canevas (px).
    pub height: u32,
}

impl Default for WasmViewport {
    fn default() -> Self {
        Self {
            width: 1280,
            height: 720,
        }
    }
}

/// Greffon Bevy 0.20.1 unifiant [`NieAssetPlugin`] et [`NieRender3dPlugin`] pour `aphrody-nie-wasm`.
#[derive(Debug, Default, Clone, Copy)]
pub struct NieWasmBevyPlugin;

impl Plugin for NieWasmBevyPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<WasmViewport>()
            .add_plugins((NieAssetPlugin::default(), NieRender3dPlugin));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wasm_bevy_plugin_boots_app_with_nie_plugins() {
        let mut app = App::new();
        app.add_plugins((bevy_asset::AssetPlugin::default(), NieWasmBevyPlugin));
        assert!(app.world().contains_resource::<WasmViewport>());
    }
}

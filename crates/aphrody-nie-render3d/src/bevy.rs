//! Intégration Bevy 0.20.1 (`App` / `Plugin` / `Mesh`) pour `aphrody-nie-render3d`.

use bevy_app::{App, Plugin};
use bevy_asset::RenderAssetUsages;
use bevy_ecs::prelude::Resource;
use bevy_mesh::{Indices, Mesh};
use bevy_wgpu_types::PrimitiveTopology;

use crate::glb::Model;

/// Ressource Bevy exposant l'état de scène 3D NIE courant.
#[derive(Resource, Debug, Default, Clone)]
pub struct NieRender3dState {
    /// Nombre de maillages téléversés dans le monde Bevy.
    pub mesh_count: usize,
}

/// Greffon Bevy 0.20.1 pour `aphrody-nie-render3d`.
#[derive(Debug, Default, Clone, Copy)]
pub struct NieRender3dPlugin;

impl Plugin for NieRender3dPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<NieRender3dState>();
    }
}

/// Convertit un [`Model`] GLB (`aphrody-nie-render3d`) en une liste de [`Mesh`] Bevy 0.20.1.
#[must_use]
pub fn glb_model_to_bevy_meshes(model: &Model) -> Vec<Mesh> {
    model
        .primitives
        .iter()
        .map(|prim| {
            let mut mesh = Mesh::new(
                PrimitiveTopology::TriangleList,
                RenderAssetUsages::default(),
            );
            mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, prim.positions.clone());
            if prim.normals.len() == prim.positions.len() {
                mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, prim.normals.clone());
            }
            if prim.uv.len() == prim.positions.len() {
                mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, prim.uv.clone());
            }
            mesh.insert_indices(Indices::U32(prim.indices.clone()));
            mesh
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::glb::Primitive;

    #[test]
    fn bevy_plugin_registers_state_and_converts_primitive() {
        let mut app = App::new();
        app.add_plugins(NieRender3dPlugin);
        assert!(app.world().contains_resource::<NieRender3dState>());

        let model = Model {
            primitives: vec![Primitive {
                positions: vec![[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
                normals: vec![[0.0, 0.0, 1.0]; 3],
                uv: vec![[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]],
                indices: vec![0, 1, 2],
                texture: None,
            }],
            textures: vec![],
        };
        let meshes = glb_model_to_bevy_meshes(&model);
        assert_eq!(meshes.len(), 1);
        assert_eq!(meshes[0].count_vertices(), 3);
    }
}

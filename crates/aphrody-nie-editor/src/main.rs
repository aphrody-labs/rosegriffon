//! Éditeur NIE natif sur Bevy 0.20.1 (`App` / `Plugin` / `Camera3d` / `Assets<Mesh>` + `taffy`).
use anyhow::Result;
use aphrody_nie_bevy::NieAssetPlugin;
use aphrody_nie_editor::EditorSession;
use aphrody_nie_render3d::{
    bevy::{NieRender3dPlugin, glb_model_to_bevy_meshes},
    document::{SceneDocumentV2, SceneObjectV2},
    glb,
};
use bevy::prelude::*;
use clap::Parser;
use std::{collections::HashMap, path::PathBuf};

#[derive(Parser)]
#[command(about = "Éditeur 3D NIE natif — Bevy 0.20.1 + DirectX 12 / Vulkan / OpenGL")]
struct Cli {
    /// Modèle GLB à importer au démarrage.
    #[arg(long)]
    glb: Option<PathBuf>,
    /// Projet JSON à ouvrir ou à créer.
    #[arg(long)]
    project: Option<PathBuf>,
}

#[derive(Resource)]
struct StudioState {
    session: EditorSession,
    assets: HashMap<String, glb::Model>,
    layout: aphrody_nie_ui::layout::EditorLayout,
    dirty: bool,
}

#[derive(Component)]
struct StudioObjectEntity;

fn main() -> Result<()> {
    let cli = Cli::parse();
    let mut session = EditorSession::default();
    let mut assets = HashMap::new();

    if let Some(project) = &cli.project
        && project.exists()
    {
        let raw = anyhow::Context::with_context(std::fs::read_to_string(project), || {
            format!("lecture de {}", project.display())
        })?;
        let doc = SceneDocumentV2::from_json(&raw)?;
        session = EditorSession::new(doc)?;
    }

    if let Some(glb_path) = &cli.glb {
        let bytes = anyhow::Context::with_context(std::fs::read(glb_path), || {
            format!("lecture de {}", glb_path.display())
        })?;
        let model = glb::parse(&bytes)?;
        let key = glb_path.to_string_lossy().into_owned();
        assets.insert(key.clone(), model);
        let name = glb_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Objet")
            .to_string();
        session.add_object(SceneObjectV2 {
            id: String::new(),
            name,
            asset: key,
            parent: None,
            position: [0.0, 0.0, 0.0],
            rotation: [0.0, 0.0, 0.0, 1.0],
            scale: [1.0, 1.0, 1.0],
            visible: true,
        })?;
    }

    let layout = aphrody_nie_ui::layout::editor_layout(1280.0, 800.0, 56.0, 280.0);
    App::new()
        .add_plugins((
            DefaultPlugins.set(WindowPlugin {
                primary_window: Some(Window {
                    title: "NIE Studio (Bevy 0.20.1)".into(),
                    resolution: (1280, 800).into(),
                    ..default()
                }),
                ..default()
            }),
            NieAssetPlugin::default(),
            NieRender3dPlugin,
        ))
        .insert_resource(StudioState {
            session,
            assets,
            layout,
            dirty: true,
        })
        .add_systems(Startup, setup_studio_scene)
        .add_systems(Update, (sync_layout_on_resize, sync_scene_meshes))
        .run();

    Ok(())
}

fn setup_studio_scene(mut commands: Commands) {
    commands.spawn((
        Camera3d::default(),
        Transform::from_xyz(0.0, 1.8, 4.5).looking_at(Vec3::new(0.0, 0.8, 0.0), Vec3::Y),
    ));
    commands.spawn((
        DirectionalLight {
            illuminance: 10_000.0,
            ..default()
        },
        Transform::from_xyz(4.0, 8.0, 4.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));
}

fn sync_layout_on_resize(windows: Query<&Window>, mut state: ResMut<StudioState>) {
    if let Ok(win) = windows.single() {
        let w = win.width();
        let h = win.height();
        let next = aphrody_nie_ui::layout::editor_layout(w, h, 56.0, 280.0);
        if next != state.layout {
            state.layout = next;
        }
    }
}

fn sync_scene_meshes(
    mut commands: Commands,
    mut state: ResMut<StudioState>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    existing: Query<Entity, With<StudioObjectEntity>>,
) {
    if !state.dirty {
        return;
    }
    state.dirty = false;
    for entity in &existing {
        commands.entity(entity).despawn();
    }
    let mat = materials.add(StandardMaterial::default());
    for obj in &state.session.document().objects {
        if !obj.visible {
            continue;
        }
        if let Some(model) = state.assets.get(&obj.asset) {
            let transform = Transform::from_translation(Vec3::from_array(obj.position))
                .with_rotation(Quat::from_array(obj.rotation))
                .with_scale(Vec3::from_array(obj.scale));
            for bevy_mesh in glb_model_to_bevy_meshes(model) {
                commands.spawn((
                    StudioObjectEntity,
                    Mesh3d(meshes.add(bevy_mesh)),
                    MeshMaterial3d(mat.clone()),
                    transform,
                ));
            }
        }
    }
}

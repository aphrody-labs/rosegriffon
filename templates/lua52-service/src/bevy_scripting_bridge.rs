// SPDX-License-Identifier: Apache-2.0
//! Sovereign Bevy + Lua 5.2 Scripting Bridge Architecture
//!
//! Demonstrates the canonical patterns for integrating Lua 5.2 scripts with Bevy ECS
//! using `mlua` and `bevy_reflect`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Component attached to any Bevy entity that possesses Lua-driven logic
#[derive(Debug, Clone)]
pub struct LuaScriptComponent {
    pub script_path: PathBuf,
    pub is_initialized: bool,
    pub reload_generation: u32,
}

impl LuaScriptComponent {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            script_path: path.into(),
            is_initialized: false,
            reload_generation: 0,
        }
    }
}

/// Simulation of reflected Bevy components exposed to Lua scripts
#[derive(Debug, Clone, Default)]
pub struct ReflectedTransform {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Clone, Default)]
pub struct ReflectedPlayerStats {
    pub health: f32,
    pub score: u32,
    pub speed: f32,
}

/// Script execution context passed to Lua callbacks (e.g. `on_update`, `on_init`)
#[derive(Debug, Clone)]
pub struct LuaExecutionContext {
    pub entity_id: u64,
    pub delta_time: f32,
    pub elapsed_time: f64,
}

/// Sovereign Lua scripting manager managing isolated or shared VM environments
pub struct SovereignLuaEngine {
    #[cfg(feature = "mlua")]
    lua: mlua::Lua,
    script_cache: HashMap<PathBuf, String>,
}

impl SovereignLuaEngine {
    /// Initialize the sovereign Lua 5.2 engine
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        #[cfg(feature = "mlua")]
        {
            let lua = mlua::Lua::new();
            Ok(Self {
                lua,
                script_cache: HashMap::new(),
            })
        }
        #[cfg(not(feature = "mlua"))]
        {
            Ok(Self {
                script_cache: HashMap::new(),
            })
        }
    }

    /// Load or hot-reload a Lua script into cache
    pub fn load_script(&mut self, path: &Path, content: &str) {
        self.script_cache.insert(path.to_path_buf(), content.to_string());
    }

    /// Execute the `on_init` lifecycle callback on an entity
    pub fn trigger_on_init(
        &mut self,
        script_path: &Path,
        context: &LuaExecutionContext,
    ) -> Result<(), String> {
        let _content = self
            .script_cache
            .get(script_path)
            .ok_or_else(|| format!("Script not cached: {:?}", script_path))?;

        #[cfg(feature = "mlua")]
        {
            let globals = self.lua.globals();
            // Bind context table
            let ctx_table = self.lua.create_table().map_err(|e| e.to_string())?;
            ctx_table.set("entity_id", context.entity_id).map_err(|e| e.to_string())?;
            ctx_table.set("delta_time", context.delta_time).map_err(|e| e.to_string())?;

            // Execute script chunk if not already loaded
            self.lua
                .load(_content)
                .set_name(script_path.to_string_lossy())
                .exec()
                .map_err(|e| e.to_string())?;

            if let Ok(on_init_fn) = globals.get::<mlua::Function>("on_init") {
                on_init_fn.call::<()>(ctx_table).map_err(|e| e.to_string())?;
            }
        }

        #[cfg(not(feature = "mlua"))]
        {
            let _ = context;
        }

        Ok(())
    }

    /// Execute the per-frame `on_update` lifecycle callback
    pub fn trigger_on_update(
        &mut self,
        script_path: &Path,
        context: &LuaExecutionContext,
        transform: &mut ReflectedTransform,
    ) -> Result<(), String> {
        let _content = self
            .script_cache
            .get(script_path)
            .ok_or_else(|| format!("Script not cached: {:?}", script_path))?;

        #[cfg(feature = "mlua")]
        {
            let globals = self.lua.globals();
            let ctx_table = self.lua.create_table().map_err(|e| e.to_string())?;
            ctx_table.set("entity_id", context.entity_id).map_err(|e| e.to_string())?;
            ctx_table.set("delta_time", context.delta_time).map_err(|e| e.to_string())?;

            if let Ok(on_update_fn) = globals.get::<mlua::Function>("on_update") {
                on_update_fn.call::<()>(ctx_table).map_err(|e| e.to_string())?;
            }
        }

        #[cfg(not(feature = "mlua"))]
        {
            let _ = (context, transform);
        }

        Ok(())
    }
}

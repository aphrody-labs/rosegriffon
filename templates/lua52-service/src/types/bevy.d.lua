---@meta
--- Bevy ECS LuaCATS type definitions for Bevy + Lua scripting integration

---@class Vec3
---@field x number
---@field y number
---@field z number
local Vec3 = {}

---@class Quat
---@field x number
---@field y number
---@field z number
---@field w number
local Quat = {}

---@class Transform
---@field translation Vec3
---@field rotation Quat
---@field scale Vec3
local Transform = {}

---@class Entity
---@field id integer
---@field index integer
---@field generation integer
local Entity = {}

---@class CollisionEvent
---@field entity_a Entity
---@field entity_b Entity
---@field impulse number
local CollisionEvent = {}

---@class BevyScriptContext
---@field entity Entity
---@field delta_time number
---@field time number
local BevyScriptContext = {}

---@class BevyWorld
local BevyWorld = {}

---Query or retrieve a component on an entity
---@generic T
---@param entity Entity
---@param component_type `T`
---@return T?
function BevyWorld.get_component(entity, component_type) end

---Mutate or insert a component on an entity
---@generic T
---@param entity Entity
---@param component T
function BevyWorld.insert_component(entity, component) end

---Despawn an entity
---@param entity Entity
function BevyWorld.despawn(entity) end

---Spawn a new entity with components
---@param components table
---@return Entity
function BevyWorld.spawn(components) end

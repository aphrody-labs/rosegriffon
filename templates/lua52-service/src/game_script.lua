---@type BevyScriptContext
local ctx = ...

---@class PlayerState
---@field score integer
---@field flags integer
---@field speed number
local Player = {
  score = 0,
  flags = 0x01, -- bit 0: alive, bit 1: invulnerable
  speed = 15.0,
}

--- Called when entity is initialized in Bevy
---@param event BevyScriptContext
function on_init(event)
  print("[Bevy Lua] Initializing player entity id: " .. tostring(event.entity.id))
  Player.score = 100
  Player.flags = bit32.bor(Player.flags, 0x02) -- activate invulnerable
end

--- Called each frame by the Bevy update schedule
---@param event BevyScriptContext
function on_update(event)
  local dt = event.delta_time
  local is_alive = bit32.btest(Player.flags, 0x01)

  if not is_alive then
    goto done
  end

  -- Query transform from Bevy ECS
  local transform = BevyWorld.get_component(event.entity, "Transform")
  if transform then
    transform.translation.x = transform.translation.x + (Player.speed * dt)
    BevyWorld.insert_component(event.entity, transform)
  end

  ::done::
end

--- Called when physics collision occurs
---@param collision CollisionEvent
function on_collision(collision)
  print("[Bevy Lua] Collision detected with entity: " .. tostring(collision.entity_b.id))
  Player.score = Player.score + 10
end

return Player

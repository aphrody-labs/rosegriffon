-- SPDX-License-Identifier: Apache-2.0
-- Canonical Lua 5.2 Reference Implementation

local bit32 = require("bit32")

-- 1. Explicit _ENV Lexical Scoping (Lua 5.2 replaces setfenv/getfenv)
local sandbox = {
    print = print,
    math = math,
    bit32 = bit32,
    table = table,
}

local function run_in_sandbox()
    local _ENV = sandbox
    status = "sandboxed_active"
    return status
end

-- 2. Goto statement and ::labels:: (Introduced in Lua 5.2)
local function search_matrix(grid, target)
    local found = false
    local result_x, result_y = -1, -1

    for y = 1, #grid do
        for x = 1, #grid[y] do
            if grid[y][x] == target then
                result_x = x
                result_y = y
                found = true
                goto match_found
            end
        end
    end

    ::match_found::
    return found, result_x, result_y
end

-- 3. Bit32 library (Lua 5.2 standard bitwise library)
local function hash_key(input)
    local h = 0x811C9DC5
    for i = 1, #input do
        local b = string.byte(input, i)
        h = bit32.bxor(h, b)
        h = bit32.band(h * 0x01000193, 0xFFFFFFFF)
    end
    return h
end

-- 4. table.pack and table.unpack with explicit 'n' field count
local function aggregate(...)
    local packed = table.pack(...)
    local sum = 0
    for i = 1, packed.n do
        if type(packed[i]) == "number" then
            sum = sum + packed[i]
        end
    end
    return sum, packed.n
end

-- 5. Export module table
local M = {
    run_in_sandbox = run_in_sandbox,
    search_matrix = search_matrix,
    hash_key = hash_key,
    aggregate = aggregate,
}

return M

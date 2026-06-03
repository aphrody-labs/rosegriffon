/**
 * Déclarations minimales pour fengari 0.1.5 (Lua 5.3 VM en JS pur).
 * Partagé entre @rose-griffon/iecode-inagle et @rose-griffon/menu-render.
 */
declare module "fengari" {
	export interface LuaState {
		readonly __fengari_brand: never;
	}

	export type LuaCFunction = (L: LuaState) => number;

	export interface FengariLua {
		readonly LUA_OK: 0;
		readonly LUA_YIELD: number;
		readonly LUA_ERRRUN: number;
		readonly LUA_ERRSYNTAX: number;
		readonly LUA_ERRMEM: number;
		readonly LUA_ERRERR: number;
		readonly LUA_MULTRET: -1;
		readonly LUA_REGISTRYINDEX: number;

		lua_gettop(L: LuaState): number;
		lua_settop(L: LuaState, n: number): void;
		lua_pop(L: LuaState, n: number): void;

		lua_pushnil(L: LuaState): void;
		lua_pushnumber(L: LuaState, n: number): void;
		lua_pushboolean(L: LuaState, b: boolean | number): void;
		lua_pushstring(L: LuaState, s: Uint8Array): void;
		lua_pushcfunction(L: LuaState, fn: LuaCFunction): void;
		lua_pushjsfunction(L: LuaState, fn: LuaCFunction): void;

		lua_setglobal(L: LuaState, name: Uint8Array | string): void;
		lua_getglobal(L: LuaState, name: Uint8Array | string): number;

		lua_call(L: LuaState, nargs: number, nresults: number): void;
		lua_pcall(L: LuaState, nargs: number, nresults: number, errfunc: number): number;

		lua_type(L: LuaState, idx: number): number;
		lua_isnil(L: LuaState, idx: number): boolean;
		lua_isnumber(L: LuaState, idx: number): boolean;
		lua_isstring(L: LuaState, idx: number): boolean;
		lua_isfunction(L: LuaState, idx: number): boolean;
		lua_istable(L: LuaState, idx: number): boolean;
		lua_isboolean(L: LuaState, idx: number): boolean;

		lua_tonumber(L: LuaState, idx: number): number;
		lua_tojsstring(L: LuaState, idx: number): string;
		lua_toboolean(L: LuaState, idx: number): boolean | number;

		lua_newtable(L: LuaState): void;
		lua_rawgeti(L: LuaState, idx: number, n: number): void;
		lua_rawseti(L: LuaState, idx: number, n: number): void;
	}

	export interface FengariLauxLib {
		luaL_newstate(): LuaState;
		luaL_loadstring(L: LuaState, s: Uint8Array): number;
		luaL_dostring(L: LuaState, s: Uint8Array): number;
		luaL_error(L: LuaState, fmt: Uint8Array, ...args: unknown[]): number;
	}

	export interface FengariLualib {
		luaL_openlibs(L: LuaState): void;
	}

	interface FengariModule {
		readonly lua: FengariLua;
		readonly lauxlib: FengariLauxLib;
		readonly lualib: FengariLualib;
		to_luastring(s: string, cache?: boolean): Uint8Array;
		to_jsstring(s: Uint8Array): string;
	}

	const fengari: FengariModule;
	export default fengari;
}

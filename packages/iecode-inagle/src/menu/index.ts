/**
 * Module menu — parseurs de fichiers .objbin IEVR.
 * Réexporte l'API publique de ObjbParser + les types du modèle.
 */

export { isObjb, ObjbParseError, parseObjb, parseObjbFile } from "./objb.js";
export type {
	AnimationComponent,
	AttachLocatorComponent,
	CollisionComponent,
	CollisionEntry,
	DispMaxEntry,
	MeshVisibleComponent,
	MeshVisibleEntry,
	MenuComponent,
	MenuComponentBase,
	MenuComponentKind,
	MenuObject,
	PrimitiveComponent,
	RenderComponent,
	SoundCmdComponent,
	SoundCmdEntry,
	TextComponent,
	TextEntry,
	UnknownComponent,
} from "./model.js";

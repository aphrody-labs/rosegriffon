// Shaders du renderer WebGPU 2D du menu IEVR.
//
// vs : pour chaque instance (un sprite), prend un quad unitaire (4 verts, triangle-strip)
//      en coordonnées [0..1]×[0..1], applique le modèle G4PKM
//      (décalage -anchor*size, scale, rotation, translation au pivot) en repère
//      canvas 1280×720 origine haut-gauche, puis projette en clip space.
// fs : échantillonne la texture (sampler nearest) ; alpha déjà prémultiplié dans la
//      texture (premultiplyAlpha au chargement) → on émet la couleur telle quelle.

struct Globals {
  // canvas de référence (1280, 720) — projection ortho.
  canvas : vec2<f32>,
  _pad   : vec2<f32>,
};

@group(0) @binding(0) var<uniform> globals : Globals;

@group(1) @binding(0) var tex  : texture_2d<f32>;
@group(1) @binding(1) var samp : sampler;

struct InstanceIn {
  // position du pivot dans le canvas (px)
  @location(0) pos    : vec2<f32>,
  // taille du quad (px) : largeur, hauteur
  @location(1) size   : vec2<f32>,
  // scale (x, y)
  @location(2) scale  : vec2<f32>,
  // ancre (0..1) dans le sprite
  @location(3) anchor : vec2<f32>,
  // rotation (radians), opacité (0..1) globale de l'instance
  @location(4) rotOp  : vec2<f32>,
  // rectangle UV dans la texture : (u0, v0, u1, v1) — permet l'atlas (phase 2)
  @location(5) uvRect : vec4<f32>,
  // multiplicateur de couleur prémultiplié (1,1,1,1 pour sprite/text ; couleur pour primitive)
  @location(6) tint   : vec4<f32>,
};

struct VSOut {
  @builtin(position) clip : vec4<f32>,
  @location(0)       uv   : vec2<f32>,
  @location(1)       opacity : f32,
  @location(2)       tint : vec4<f32>,
};

// 4 coins du quad unitaire (triangle-strip) : (0,0)(1,0)(0,1)(1,1)
fn corner(vid : u32) -> vec2<f32> {
  // bit 0 = x, bit 1 = y
  let x = f32(vid & 1u);
  let y = f32((vid >> 1u) & 1u);
  return vec2<f32>(x, y);
}

@vertex
fn vs(@builtin(vertex_index) vid : u32, inst : InstanceIn) -> VSOut {
  let c = corner(vid);

  // position locale dans le sprite (px), origine = coin haut-gauche du sprite,
  // décalée pour que l'ancre tombe sur le pivot.
  var local = (c - inst.anchor) * inst.size;

  // scale
  local = local * inst.scale;

  // rotation (radians) — repère écran +Y vers le bas.
  let s = sin(inst.rotOp.x);
  let co = cos(inst.rotOp.x);
  let rotated = vec2<f32>(
    local.x * co - local.y * s,
    local.x * s + local.y * co,
  );

  // translation au pivot → coordonnées canvas (px).
  let canvasPos = inst.pos + rotated;

  // projection ortho : origine haut-gauche, +Y vers le bas.
  let ndcX = (2.0 * canvasPos.x / globals.canvas.x) - 1.0;
  let ndcY = 1.0 - (2.0 * canvasPos.y / globals.canvas.y);

  // UV interpolé dans le rectangle de l'atlas.
  let uv = vec2<f32>(
    mix(inst.uvRect.x, inst.uvRect.z, c.x),
    mix(inst.uvRect.y, inst.uvRect.w, c.y),
  );

  var out : VSOut;
  out.clip = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.uv = uv;
  out.opacity = inst.rotOp.y;
  out.tint = inst.tint;
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
  // texture déjà prémultipliée (premultiplyAlpha:'premultiply').
  // tint = multiplicateur de couleur prémultiplié (couleur des primitives, neutre sinon) ;
  // opacity = transparence d'instance (sprite/text). Les deux conservent l'invariant prémultiplié.
  let texel = textureSample(tex, samp, in.uv);
  return texel * in.tint * in.opacity;
}

// ─── Pipeline GLYPHE (atlas de police + contour) ──────────────────────────────────
//
// Reproduit `2d_font_outline.pfxo` du jeu : DILATATION 8-tap.
//   1. fill = couverture du centre (canal alpha de l'atlas) ;
//   2. outline = max(fill, 8 échantillons décalés d'un anneau = forme dilatée) ;
//   3. rgb = mix(outlineColor, fillColor, fill) — centre = remplissage, bord = contour ;
//   4. alpha = outline * a.
// La sortie est prémultipliée (rgb *= alpha) pour le blend "over" du renderer.
//
// L'instance de glyphe a sa PROPRE disposition (slot 0) : géométrie identique +
// fillColor(4) + outlineColor(4) + (outlineWidth, atlasTexelU, atlasTexelV, opacity).

struct GlyphInstanceIn {
  @location(0) pos        : vec2<f32>,
  @location(1) size       : vec2<f32>,
  @location(2) scale      : vec2<f32>,
  @location(3) anchor     : vec2<f32>,
  @location(4) rot        : vec2<f32>,   // rot, _pad
  @location(5) uvRect     : vec4<f32>,   // u0,v0,u1,v1
  @location(6) fillColor  : vec4<f32>,   // rgba non prémultiplié (0..1)
  @location(7) outlineCol : vec4<f32>,   // rgba non prémultiplié (0..1)
  // x = demi-largeur de contour en UV (déjà = outlineWidthPx / atlasSize),
  // y/z = pas de texel UV (1/atlasW, 1/atlasH) pour clamp éventuel,
  // w = opacité d'instance (0..1).
  @location(8) outlineP   : vec4<f32>,
};

struct GlyphVSOut {
  @builtin(position) clip       : vec4<f32>,
  @location(0)       uv         : vec2<f32>,
  @location(1)       fillColor  : vec4<f32>,
  @location(2)       outlineCol : vec4<f32>,
  @location(3)       outlineP   : vec4<f32>,
};

@vertex
fn vs_glyph(@builtin(vertex_index) vid : u32, inst : GlyphInstanceIn) -> GlyphVSOut {
  let c = corner(vid);
  var local = (c - inst.anchor) * inst.size;
  local = local * inst.scale;
  let s = sin(inst.rot.x);
  let co = cos(inst.rot.x);
  let rotated = vec2<f32>(local.x * co - local.y * s, local.x * s + local.y * co);
  let canvasPos = inst.pos + rotated;
  let ndcX = (2.0 * canvasPos.x / globals.canvas.x) - 1.0;
  let ndcY = 1.0 - (2.0 * canvasPos.y / globals.canvas.y);
  let uv = vec2<f32>(
    mix(inst.uvRect.x, inst.uvRect.z, c.x),
    mix(inst.uvRect.y, inst.uvRect.w, c.y),
  );
  var out : GlyphVSOut;
  out.clip = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
  out.uv = uv;
  out.fillColor = inst.fillColor;
  out.outlineCol = inst.outlineCol;
  out.outlineP = inst.outlineP;
  return out;
}

// Échantillonne le canal de couverture de l'atlas (alpha) à un offset UV donné.
fn glyphCoverage(uv : vec2<f32>) -> f32 {
  return textureSample(tex, samp, uv).a;
}

@fragment
fn fs_glyph(in : GlyphVSOut) -> @location(0) vec4<f32> {
  let w = in.outlineP.x;        // demi-largeur de contour en UV
  let opacity = in.outlineP.w;

  // 1. Couverture du centre = remplissage.
  let fill = glyphCoverage(in.uv);

  // 2. Dilatation 8-tap (anneau : 4 axes + 4 diagonales). max sur centre + 8.
  let d = w;
  let dd = w * 0.70710677; // diagonale : longueur du rayon conservée
  var outline = fill;
  outline = max(outline, glyphCoverage(in.uv + vec2<f32>( d,  0.0)));
  outline = max(outline, glyphCoverage(in.uv + vec2<f32>(-d,  0.0)));
  outline = max(outline, glyphCoverage(in.uv + vec2<f32>(0.0,  d)));
  outline = max(outline, glyphCoverage(in.uv + vec2<f32>(0.0, -d)));
  outline = max(outline, glyphCoverage(in.uv + vec2<f32>( dd,  dd)));
  outline = max(outline, glyphCoverage(in.uv + vec2<f32>(-dd,  dd)));
  outline = max(outline, glyphCoverage(in.uv + vec2<f32>( dd, -dd)));
  outline = max(outline, glyphCoverage(in.uv + vec2<f32>(-dd, -dd)));

  // 3. Couleur : centre = remplissage, bord dilaté = couleur de contour.
  let rgb = mix(in.outlineCol.rgb, in.fillColor.rgb, fill);

  // 4. Alpha : la forme dilatée porte l'opacité (× opacité d'instance).
  let a = outline * in.fillColor.a * opacity;

  // Sortie prémultipliée pour le blend "over".
  return vec4<f32>(rgb * a, a);
}

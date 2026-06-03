using System.Linq;
using IECODE.Core.Formats.Level5;
using Xunit;

namespace IECODE.Core.Tests;

/// <summary>
/// Tests de l'extraction de géométrie G4MG (sans en-tête) pilotée par le .g4md compagnon.
///
/// Les .g4mg réels n'ont AUCUN magic ni header : l'offset 0 est de la donnée vertex et toute
/// la métadonnée géométrique vit dans le .g4md. Ces tests valident l'extraction sur des octets
/// réels embarqués (le bloc d'index de l'échantillon menu mainmenu90_02_2.g4mg, dont les
/// indices confirmés sont [0,1,2,0,2,3]).
/// </summary>
public class G4mgGeometryTests
{
    /// <summary>
    /// 192 octets réels de data/common/menu/.../mainmenu90_02_2.g4mg (sans en-tête).
    /// Offset 0 = float 1.0f (0x3F800000) ; indices u16 [0,1,2,0,2,3] à l'offset 0x80.
    /// </summary>
    private static readonly byte[] MenuG4mg =
    [
        0,0,128,63,0,0,0,0,0,0,0,0,0,0,0,0,
        255,127,255,127,255,255,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,255,127,255,127,0,0,0,0,
        0,0,0,0,0,0,128,191,0,0,0,0,0,0,0,0,
        255,127,255,127,0,0,255,255,0,0,128,63,0,0,128,191,
        0,0,0,0,0,0,0,0,255,127,255,127,255,255,255,255,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,1,0,2,0,0,0,2,0,3,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    ];

    /// <summary>
    /// G4MD synthétique minimal décrivant l'échantillon menu (le fichier menu réel n'a pas de
    /// .g4md sur disque) : 1 sous-maille, vert_count=4, face_count=6, stride=32, vert_offset=0,
    /// face_offset=0, face_data_base=0x80. Construit selon la disposition vérifiée sur les
    /// vrais chr/_uniform et chr/_face.
    /// </summary>
    private static readonly byte[] MenuG4md =
    [
        71,52,77,68,160,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        1,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,128,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,4,0,0,0,6,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,32,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    ];

    [Fact]
    public void ExtractGeometry_MenuSample_IndicesAreQuadTriList()
    {
        var g4md = new G4mdParser();
        g4md.Parse(MenuG4md);

        Assert.Equal(1, g4md.Header.SubmeshCount);
        Assert.Equal((uint)0x80, g4md.Header.FaceDataBase);
        Assert.Single(g4md.Submeshes);
        Assert.Equal(4, g4md.Submeshes[0].VertexCount);
        Assert.Equal(6, g4md.Submeshes[0].IndexCount);
        Assert.Equal(32, g4md.Submeshes[0].VertexStride);

        var geometry = G4mgParser.ExtractGeometry(MenuG4mg, g4md);

        Assert.Single(geometry);
        var sm = geometry[0];

        // Indices confirmés du quad menu (2 triangles).
        Assert.Equal(new uint[] { 0, 1, 2, 0, 2, 3 }, sm.Indices.ToArray());

        // 4 positions décodées (float3 à +0 de chaque vertex de 32 octets).
        Assert.Equal(4, sm.Positions.Count);
        Assert.False(sm.Index32);

        // Le vertex 0 commence par 0x3F800000 = 1.0f sur l'axe X.
        Assert.Equal(1.0f, sm.Positions[0].X, precision: 5);
    }

    [Fact]
    public void ExtractGeometry_NoCompanionParser_Throws()
    {
        // Confirme l'absence de chemin « magic G4MG » fictif : on ne décode jamais sans .g4md.
        Assert.Throws<System.NotSupportedException>(
            () => G4mgParser.ParseMeshes(MenuG4mg));
    }
}

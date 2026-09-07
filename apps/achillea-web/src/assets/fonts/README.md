# Polices Achilléa

Toutes les fontes Achilléa sont fournies en `.woff2` (Brotli, ~65 % vs OTF/TTF source).

| Famille CSS            | Source Drive                                             | Fichier livré                        |
| ---------------------- | -------------------------------------------------------- | ------------------------------------ |
| `Achillea Display`     | `typo/titre/Dirtyline-36Daysoftype-2022-01045748000.zip` | `Dirtyline-36DOT.woff2`              |
| `Achillea Title`       | `typo/titre/HUMANE Typeface.zip`                         | `HUMANE.woff2` + `HUMANE-Bold.woff2` |
| `Achillea Title Alt`   | `typo/titre/Neue-Metana-Next-Free-Font-01015467500.zip`  | `NeueMetanaNext.woff2`               |
| `Achillea Mono`        | `typo/intertitre/liberation-mono.zip`                    | `LiberationMono.woff2`               |
| `Achillea Body`        | `typo/corps de texte/msgothic.ttc`                       | `MSGothic.woff2`                     |
| `Achillea Display Num` | `typo/numéro coupe d'ilion/Satoshi-Black.otf`            | `Satoshi-Black.woff2`                |

Inter (corps par défaut) : `InterVariable.woff2` + `InterVariable-Italic.woff2`.

Régénération depuis OTF/TTF source :

```bash
sudo apt install -y woff2
woff2_compress fontfile.otf  # produit fontfile.woff2 in-place
```

Vérifier les licences (usage commercial + embedding web) avant publication — voir CDC §4.1.4.

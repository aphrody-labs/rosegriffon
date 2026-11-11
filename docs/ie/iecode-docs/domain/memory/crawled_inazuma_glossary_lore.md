# Synthèse Souveraine : Glossaire, Lore & Modèles de Synchronisation Cron Inazuma Eleven

> **Document de Référence et Mémoire Persistante** — Aphrody Autonomous Production Engine
> **Date d'Ingestion & Consolidation :** 2026-09-09
> **Auteur & Vision :** 日野 晃博 (Akihiro Hino) x LEVEL-5 x Niers VFS Engine
> **Sources Primaires :**
>
> - VFS Inazuma Eleven: Victory Road (`/home/ubuntu/niers/data/azalee/` & `game-text-names.ndjson.gz`)
> - Glossaire Dérivé Inagle & Manifestes (`/home/ubuntu/niers/data/glossary/inazuma-glossary.json`, `azalee-tweets.json`)
> - Démons de Synchronisation (`/home/ubuntu/niers/packages/cron/` & `/home/ubuntu/rg/packages/cron/`)
> - Répertoire Azalée (`skills-cutin.json`, `passives-full.json`, `character-model-manifest.json`, `zukan-audit.json`)

---

## 1. Vue d'Ensemble & Métriques d'Ingestion

L'ingestion complète unifie les données de jeu brutes, les manifestes de modèles 3D, le glossaire multilingue officiel et les flux de synchronisation réseau :

- **Personnages Totaux Référencés (VFS) :** 19,725 joueurs indexés (500 synthétisés en fiches actives).
- **Super Techniques (Hissatsu Waza) :** 2,705 techniques répertoriées avec correspondances tri-lingues.
- **Équipes Officielles :** 371 clubs, sélections et académies.
- **Termes Système & Menus :** 2,776 concepts d'interface et règles de jeu.
- **Cut-ins Vidéo & Télops de Compétences :** 2 animations cinématiques cartographiées.
- **Talents Passifs Paramétrés :** 4 passifs de build et multiplicateurs.
- **Veille Sociale Crawlée (X / Twitter @Azalee_IE) :** 53 publications et threads archivés couvrant les versions 1.0.0 à 5.1.0.

---

## 2. Terminologie Officielle & Système Hyperdimensionnel (FR / JA / EN)

### 2.1. Concepts Fondamentaux de Match & Règles de Jeu

| Terme Français      | Terme Japonais            | Terme Anglais            | Description Canonique                                                                                                      |
| ------------------- | ------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Super Technique** | 必殺技 (Hissatsu Waza)    | Special Move             | Compétence footballistique hors norme consommant la jauge de Tension (Tir, Dribble, Bloc, Arrêt).                          |
| **Tension**         | テンション (Tension)      | Tension Gauge            | Ressource globale partagée par l'équipe remplaçant les anciens PT/TP. Alimentée par le jeu de passes, tacles et pressing.  |
| **Focus**           | フォーカス (Focus Battle) | Focus Battle             | Duel 1-contre-1 au sol en temps réel. Analyse de la direction de percée et calcul des statistiques de Contrôle vs Garde.   |
| **Scramble**        | スクランブル (Scramble)   | Scramble Battle          | Duel aérien pour le contrôle d'un ballon libre. Déterminé par le timing d'impact et la Puissance physique.                 |
| **Zone**            | ゾーン (Zone)             | The Zone                 | Ralentissement du flux temporel aux abords de la surface adverse, permettant d'ajuster l'angle de frappe ou une passe clé. |
| **Esprit Guerrier** | 化身 (Keshin)             | Fighting Spirit / Avatar | Avatar spirituel projeté par le joueur. Multiplie la puissance offensive/défensive et débloque un Hissatsu exclusif.       |
| **Totem**           | ソウル (Soul)             | Soul                     | Matérialisation de l'âme animale du joueur. Amplifie l'instinct pur et les statistiques primaires.                         |
| **Éveil**           | 覚醒 (Kakusei)            | Awakening                | Libération temporaire de l'énergie maximale latente d'un joueur sous condition de match.                                   |
| **Miximax**         | ミキシマックス (Mixi Max) | Miximax                  | Fusion de l'aura et de l'ADN footballistique entre deux joueurs pour cumuler leurs talents et compétences.                 |

### 2.2. Roue Élémentaire & Cycle d'Affinité (4 Éléments)

L'équilibrage IEVR consacre un bonus de dégâts et d'efficacité de **+20%** en situation d'avantage élémentaire :

- **Feu (火 / Fire) :** Puissance offensive pure. Fort contre **Bois/Forêt**, faible contre **Montagne/Terre**.
- **Bois / Forêt (木・林 / Forest) :** Maîtrise technique et contrôle tactique. Fort contre **Vent**, faible contre **Feu**.
- **Vent (風 / Wind) :** Agilité extrême, vitesse et contre-attaque. Fort contre **Montagne/Terre**, faible contre **Bois/Forêt**.
- **Montagne / Terre (山 / Earth) :** Résistance physique inébranlable et garde de fer. Fort contre **Feu**, faible contre **Vent**.

### 2.3. Architecture VFS Level-5 (Nie VFS & Formats G4)

- **G4 Container (.g4md, .g4mg, .g4pkm) :** Moteur d'actifs 3D propriétaire Level-5 :
  - `.g4md` (Model Descriptor) : Définition des matériaux, shaders PBR, canaux de couleurs et rigging.
  - `.g4mg` (Mesh Geometry) : Tampons de sommets (positions, normales, tangentes, UVs) et indices de sous-maillages.
  - `.g4pkm` (Package Motion) : Bibliothèques d'animations squelettiques et cinématiques de super-techniques.
- **Nie VFS (Virtual File System) :** Implémentation Rust (`crates/nie-vfs`) montant en mémoire vive les archives CPK (`data/azalee/cpk-index.ndjson.gz`), offrant une résolution d'offset instantanée.
- **Inagle :** Moteur TypeScript et parser des tables binaires `cfg.bin.json` du jeu, garantissant l'extraction exacte des fiches de joueurs.

---

## 3. Matrice Exhaustive des Super Techniques (Hissatsu Waza)

### 3.1. Les Techniques Divines Mythiques (Panthéon Aphrodi & Zeus)

| Technique (FR)                      | Technique (JA) | Technique (EN) | Catégorie     | Coût / Puissance    | Description Technique                                                                                                                                             |
| ----------------------------------- | -------------- | -------------- | ------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Savoir Suprême (God Knows)**      | ゴッドノウズ   | God Knows      | Tir           | 70 Tension / Pw 440 | Déploiement d'ailes lumineuses célestes dans le dos, projection ascendante du ballon puis frappe foudroyante enveloppée de lumière divine.                        |
| **Instant Céleste (Heaven's Time)** | ヘブンズタイム | Heaven's Time  | Dribble       | 80 Tension / Pw 540 | Claquement de doigts figeant le temps pour tous les adversaires. Le joueur traverse les lignes adverses avec grâce avant que la tornade temporelle ne les balaie. |
| **Tir Solaire (God Break)**         | ゴッドブレイク | God Break      | Tir           | 80 Tension / Pw 540 | Évolution transcendante de God Knows. Tir aérien saturé d'énergie dorée incandescente capable de pulvériser les mains géantes des gardiens.                       |
| **Tir du Chaos (Chaos Break)**      | カオスブレイク | Chaos Break    | Tir (Combiné) | 85 Tension / Pw 590 | Frappe tridirectionnelle fusionnant la lumière divine d'Aphrodi, le blizzard de Gazelle et les flammes solaires de Torch.                                         |

### 3.2. Échantillon de Super Techniques Trilingues Indexées

| Nom Français                                                 | Nom Japonais                                                | Nom Anglais | Hash VFS |
| ------------------------------------------------------------ | ----------------------------------------------------------- | ----------- | -------- |
| **En vous sautant dessus comme un tremplin,                  |
| votre coéquipier exécutera un tir foudroyant.**              | 大きな体を　踏み台にして飛び上がり                          |
| 稲妻のような一撃を落とす。                                   | Use a large player's body as a springboard to shoot         |
| a high ball down like lightning from the sky.                | `0x87AB9FB9`                                                |
| **Une combinaison où deux joueurs frappent le ballon         |
| à tour de rôle pour augmenter la puissance du tir.**         | ２人で交互にボールを蹴りながら力を込めて                    |
| シュートの破壊力をアップさせる合体技。                       | Two players kick the ball to each other at full             |
| force to amplify the power of the final shot.                | `0xAC86CC7A`                                                |
| **Tir enflammé lancé depuis les airs.                        |
| La balle en feu transperce le but.**                         | 天高く舞い上がる　真っ赤なトルネード。                      |
| 激しい炎をまとって　ゴールを焼き尽くす。                     | Unleash a fiery shot from midair.                           |
| The deadly ball enveloped in flames pierces                  |
| straight to the goal.                                        | `0xB59DFD3B`                                                |
| **Piétinez le ballon plusieurs fois pour engranger           |
| de la puissance et décocher un super tir.**                  | ボールに怒濤の連続キックを叩き込み                          |
| 空中からシュートを放つ　スーパーショット。                   | Deliver a series of frenzied kicks to the ball              |
| before unleashing a super shot from mid-air.                 | `0xFADC6BFC`                                                |
| **Un tir exécuté par deux joueurs qui synchronisent          |
| leur respiration, preuve de leur lien indéfectible.**        | ２人の息を合わせて　渾身の一撃を放つ                        |
| 友情の証の　ツープラトンシュート。                           | Two players move in perfect sync, unleashing                |
| a powerful combo shot in a show of friendship.               | `0xE3C75ABD`                                                |
| **Concentre toute la puissance du corps dans la              |
| jambe droite pour effectuer un tir superpuissant,            |
| tel le rugissement d'un dragon azur.**                       | 右足に　全身全霊の力を込めて放つ。                          |
| 青きドラゴンの　咆哮とどろくシュート技。                     | Harry the opposition with                                   |
| a merciless roar borne from a dragon's might.                | `0xC8EA097E`                                                |
| **Tordez votre corps pour donner de l'élan                   |
| à une puissante frappe dans le ballon.**                     | 体をひねって溜め込んだパワーを                              |
| 一気にボールへ叩き込む　一撃必殺ショット。                   | Twist the body to build power and drive it into the         |
| ball all at once for a knockout special move.                | `0xD1F1383F`                                                |
| **Lance un tir depuis le triangle de la mort.                |
| Une parfaite synchronisation est essentielle.**              | 死のトライアングルからシュートを放つ。                      |
| ３人の息を合わせることが最重要。                             | Shoot from the Triangle of Death.                           |
| Synergy between the three players is highly important.       | `0x566924F0`                                                |
| **Terrifiante technique qui fait apparaître un ballon        |
| fantôme pour tromper le gardien.**                           | 人魂のような　ボールの幻を出現させて                        |
| キーパーを惑わせる　不気味な技。                             | Manifest eerie ball-shaped will-o'-the-wisps to             |
| confuse the goalkeeper.                                      | `0x4F7215B1`                                                |
| **Faites-vous propulser vers le ciel et tirez pendant        |
| que vous retombez à toute vitesse vers le sol.**             | 仲間の力で　空高くへと舞い上がり                            |
| 猛スピードで滑空しながら　シュートを放つ。                   | Have your allies boost you skyward and                      |
| fire a shot as you dive at blistering speed.                 | `0x9F72C4CF`                                                |
| **Catapultez le ballon tel un météore                        |
| qui part s'écraser dans les buts !**                         | ボールと共に流れ星となって                                  |
| ゴールに墜落する　隕石級の特攻技。                           | Slam the ball to send it crashing like                      |
| a meteor straight toward the goal!                           | `0x8669F58E`                                                |
| **Frappez dans un ballon qui se tord et s'enroule            |
| tel un serpent, laissant le gardien complètement             |
| désemparé.**                                                 | 蛇のような　うねる軌道を描いて                              |
| キーパーを惑わすスーパードライブシュート。                   | Strike with a serpentine drive that twists                  |
| and coils, leaving the keeper bewildered.                    | `0xAD44A64D`                                                |
| **Vous foncez vers le but telle une tornade.                 |
| Malgré le tournis, vous ne manquez pas votre cible.**        | 竜巻のような軌道でゴールへ駆け抜ける。                      |
| 目が回っても　決して狙いは外さない。                         | Rush at the goal like a destructive tornado.                |
| The move is difficult to control, but will never miss.       | `0xB45F970C`                                                |
| **Faites surgir le ballon du ciel comme une comète           |
| enflammée qui illumine tout sur son passage.**               | 彗星のようにゴールへと降りそそぎ                            |
| まばゆい光の尾を引く　美しい技。                             | Rain the ball down like a blazing comet,                    |
| leaving a trail of light in its wake.                        | `0xFB1E01CB`                                                |
| **Une frappe acrobatique qui canalise toute la               |
| puissance de gracieuses rotations aériennes.**               | 芸術的な空中回転で溜め込んだパワーを                        |
| ボールへ叩き込む　アクロバティックな一撃。                   | Execute artistic mid-air somersaults to build               |
| power for an acrobatic shot.                                 | `0xE205308A`                                                |
| **Un tir ninja outrancier qui consiste à se dédoubler        |
| pour frapper le ballon de trois côtés différents.**          | 忍法で分身し　３方向からキックを叩き込む                    |
| 反則級の忍術シュート。                                       | A barely legal move that uses ninja clones to kick          |
| the ball from three different angles.                        | `0xC9286349`                                                |
| **Déchirez les buts suite à un tir retourné explosif         |
| qui fera trembler les filets.**                              | シュートの威力でゴールポストが大爆発。                      |
| ダイナマイト級のオーバーヘッドキック。                       | Blast the goal with an explosive overhead kick              |
| that shakes the net.                                         | `0xD0335208`                                                |
| **Un tir guerrier qui propulse le ballon                     |
| vers le but tel un véritable missile.**                      | 蹴り上げたボールが　ミサイルのように                        |
| どこまでもゴールを狙う　弾丸シュート。                       | The ball is kicked high up                                  |
| and rockets to the goal like a missile.                      | `0x57AB4EC7`                                                |
| **Faites tourner le ballon pour accumuler                    |
| de l'énergie, puis exécutez un tir tournoyant                |
| imparable.**                                                 | ボールに回転をかけてエネルギーを蓄積し                      |
| 渦巻くシュートで　ゴールを貫く。                             | Spin the ball to build energy,                              |
| and hit the goal with a swirling, piercing shot.             | `0x4EB07F86`                                                |
| **Gelez les alentours d'un regard glacial,                   |
| puis exécutez un terrifiant tir de glace.**                  | 氷のような眼差しで　周囲を凍てつかせ                        |
| 冷たく重い一撃を放つ　恐怖のシュート。                       | Freeze your surroundings with a glacier stare, and          |
| unleash a fearsome ice-cold shot.                            | `0x9D347A96`                                                |
| **Un puissant tir en croix combinant une                     |
| frappe horizontale à une frappe verticale.**                 | 縦と横　２方向からのパワーを込めた                          |
| クロス状のオーラをまとうドライブシュート。                   | A drive shot carried along by a cross-shaped aura           |
| formed through powerful kicks in two intersecting            |
| directions.                                                  | `0x842F4BD7`                                                |
| **Faites disparaître puis réapparaître le ballon             |
| semant la confusion chez le gardien à la dernière seconde.** | キーパーの目の前で　ボールが神隠しに？                      |
| まるで超常現象のような　消える魔球。                         | Make the ball vanish and reappear,                          |
| confounding the keeper at the last second.                   | `0xAF021814`                                                |
| **Soulevez et contrôlez le ballon en plein air               |
| grâce à des pouvoirs psychokinétiques,                       |
| avant de le projeter dans les buts.**                        | 強力なサイコキネシスで宙に浮かび上がり                      |
| ボールを自在に操って　シュートを決める。                     | Lift and control the ball midair with psychokinetic         |
| power, then slam it into the goal.                           | `0xB6192955`                                                |
| **Élevez-vous dans les airs et plongez vers                  |
| le ballon pour exécuter un redoutable tir                    |
| semblable à un condor qui fond sur sa proie.**               | 上空に舞い上がり　ボール目がけて急降下！                    |
| 獲物を狙うコンドルのような鋭いシュート。                     | Leap up and dive sharply headfirst toward the ball,         |
| like a condor aiming for prey.                               | `0xF958BF92`                                                |
| **Courez sur le ballon pour le faire accélérer,              |
| puis envoyez-le directement vers le but.**                   | ボールの上で全力ダッシュし　加速度アップ！                  |
| 勢いのついたボールが　ゴールを狙う。                         | Dash atop the ball to accelerate it                         |
| so it blasts for the goal with boosted speed.                | `0xE0438ED3`                                                |
| **Un tir coordonné exécuté à l'unisson par trois             |
| joueurs, avec une trajectoire en forme de Z.**               | シュートの軌道が　Ｚの形を描く                              |
| ３人の息を合わせて繰り出す　連携シュート。                   | Three players come together to create a combo shot          |
| with a Z-shaped trajectory.                                  | `0xCB6EDD10`                                                |
| **Frappez la ballon en utilisant un coéquipier comme         |
| une batte. Seuls des joueurs aux liens étroits               |
| peuvent réaliser cette technique.**                          | 味方の選手をバットに見立てて振り抜く                        |
| お互いに信頼関係がないと成立しない技。                       | Grab a teammate to use as a bat in an ultimate show of      |
| mutual trust.                                                | `0xD275EC51`                                                |
| **Un tir imprévisible qui fait rebondir le                   |
| ballon sur des rochers flottants.**                          | 浮かび上がった大地の欠片に                                  |
| ボールを反射させる　予測不能なシュート。                     | An unpredictable shot that bounces off fragments of         |
| the ground floating in the air.                              | `0x55EDF09E`                                                |
| **Un super tir de la tête qui utilise une technique de       |
| kung-fu pour développer une grande puissance.**              | クンフーの技を駆使して　威力を高める                        |
| スーパーヘディングシュート。                                 | Utilize kung fu moves to supercharge the strength of        |
| a header shot.                                               | `0x4CF6C1DF`                                                |
| **Un tir surpuissant qui émet une intense lumière            |
| semblable au soleil pour éblouir le gardien.**               | 太陽の眩しさが　キーパーの目をくらませる                    |
| 強烈な光を放つドライブシュート。                             | Unleash an impossibly bright drive shot that blinds         |
| the goalkeeper.                                              | `0x9CF610A1`                                                |
| **Un noble tir imprégnant le ballon d'une colère             |
| divine qui le transforme en flèche imparable.**              | 神の怒りを宿した気高きボールは                              |
| 全てを貫く　シュートの矢となる。                             | Infused with the wrath of God, the ball                     |
| pierces through all things like a divine arrow.              | `0x85ED21E0`                                                |
| **Telle une tornade bleu vif, élevez-vous vers le ciel       |
| pour exécuter un tir fatal du talon.**                       | 天高く舞い上がる　真っ青なトルネード。                      |
| 回転かかと落としでゴールを貫く。                             | Rise high up like a bright blue tornado and aim for         |
| the goal using a spinning back heel kick.                    | `0xAEC07223`                                                |
| **Tel Tarzan, sautez de liane en liane                       |
| pour prendre de l'élan et exécuter un tir.**                 | ターザンのように　ツタからツタへ飛び移り                    |
| 勢いをつけてシュートを放つ。                                 | Swing from vine to vine like Tarzan and use the             |
| momentum to unleash a forceful shot.                         | `0xB7DB4362`                                                |
| **Même les lois de l'univers sombrent dans                   |
| l'oubli. Une telle puissance ne peut                         |
| être que l'œuvre du divin.**                                 | 宇宙の法則すらも忘却の彼方に消失させる。                    |
| その圧倒的なパワーは　まさに神の所業か。                     | Banish even the laws of the universe into oblivion.         |
| This overwhelming power is nothing short of a divine act.    | `0xF89AD5A5`                                                |
| **Un tir spécial qui combine la puissance                    |
| du Choc du dragon et de la Tornade de feu.**                 | ドラゴンクラッシュとファイアトルネードの                    |
| ２つが合体した　強烈な必殺シュート。                         | A powerful special move that is a combination of            |
| Dragon Crash and Fire Tornado.                               | `0xE181E4E4`                                                |
| **Le ballon roule au sol pour accumuler de la                |
| puissance avant de se transformer en une                     |
| boule de terre qui fonce tout droit vers le but.**           | 地面を転がりながら力を蓄えたボールが                        |
| 土だるまとなって襲いかかる　重たい一撃。                     | The ball rolls along the ground and builds power,           |
| turning into a crushing dirt ball strike.                    | `0xCAACB727`                                                |
| **Chargé de la puissance de deux joueurs, le ballon          |
| s'envole vers le but enveloppé d'ailes de feu.**             | ２人の力を込めたボールが　炎の翼をまとい                    |
| 羽ばたくようにゴールを狙う。                                 | Two players kick the ball with full force and make          |
| it fly towards the goal as if with fiery wings.              | `0xD3B78666`                                                |
| **Trois joueurs s'élancent dans les airs pour                |
| insuffler la puissance de l'éclair au ballon et              |
| exécuter un tir foudroyant.**                                | 強力な雷を　ボールに込めて高く蹴り出し                      |
| 落雷のイナズマボールを　３人でシュート！                     | Three players charge the ball with thunder                  |
| and launch it high for a lightning-like shot!                | `0x542F9AA9`                                                |
| **Invoquez la puissance de la Main céleste                   |
| pour franchir le cosmos d'un bond                            |
| et projeter un tir cosmique.**                               | ゴッドハンドの力で宇宙に大ジャンプ！                        |
| 大気圏すら貫く　超次元合体シュート。                         | Channel the power of God Hand to leap across                |
| the cosmos and slam a cosmic shot.                           | `0x4D34ABE8`                                                |
| **Technique améliorée allégeant la charge                    |
| de Manchot empereur nº 1, où planent                         |
| fièrement dans les cieux des manchots.**                     | 皇帝ペンギン１号の負荷を軽減した改良技。                    |
| 帝国の誇りをまとったペンギンが空を舞う。                     | A move that lessens the burden of                           |
| Emperor Penguin No. 1.                                       |
| Summon penguins that take to the skies for the empire.       | `0x99B90624`                                                |
| **Le ballon se transforme en véritable phénix                |
| qui fonce vers le but dans un battement d'ailes.**           | 炎をまとったボールがフェニックスに変化！                    |
| 翼をはためかせながら　ゴールを狙う。                         | A flame-clad ball transforms into a phoenix                 |
| that dives directly for the goal!                            | `0x80A23765`                                                |
| **Un tir électrique accompagné                               |
| par un mignon dragon noir.**                                 | かわいい顔した　すごい奴。                                  |
| 放て　電撃ドラゴンシュート！                                 | He might be cute, but this baby                             |
| dragon has a shot like lightning!                            | `0xAB8F64A6`                                                |
| **Un tir maléfique enflammé porté par une tornade            |
| sombre qui engloutit tout sur son passage.**                 | 禁断の力を秘めた　漆黒のトルネード。                        |
| 邪悪な炎をまとって　ゴールを飲み込む。                       | A dark tornado of forbidden power engulfs                   |
| the goal with its cursed flames.                             | `0xB29455E7`                                                |
| **Utilisez votre esprit affûté et la puissance               |
| du givre pour provoquer un blizzard dans                     |
| la surface de réparation.**                                  | 研ぎ澄ました精神で　凍える氷雪を呼び                        |
| ゴールエリアに　ブリザードを巻き起こす。                     | Sharpened focus summons freezing snow and                   |
| conjures up a blizzard at the goal area.                     | `0xFDD5C320`                                                |
| **La passion s'enflamme, explose en une tempête brûlante     |
| qui ravage tout sur son passage.**                           | 燃えたぎる情熱が　いま爆発する。                            |
| 炎の嵐が吹き荒れる　灼熱の究極奥義。                         | Passion ignites, exploding into a scorching storm           |
| that burns all in its path.                                  | `0xE4CEF261`                                                |
| **Technique déchaînant une immense vague,                    |
| fendue par un formidable tir long.**                         | ビッグウェーブに乗って繰り出すイカした技。                  |
| 豪快なロングシュートが波を切り裂く。                         | Ride a massive wave and perform an impressive long shot     |
| that rips through the water toward the goal.                 | `0xCFE3A1A2`                                                |
| **Version améliorée du Triangle de la mort.                  |
| Trois joueurs allient leurs forces pour                      |
| libérer une immense puissance.**                             | デスゾーンを改良して生まれた究極奥義。                      |
| ３人の個性が激突し　強大な力を解き放つ。                     | An ultimate technique, developed as an improvement          |
| for Death Zone. When three personalities collide,            |
| immense power is unleashed.                                  | `0xD6F890E3`                                                |
| **Le cœur des 11 joueurs bat à l'unisson.                    |
| Technique surpuissante héritée de DAISUKE.**                 | １１人全員の思いが　いま１つになる。                        |
| 円堂大介が残した　超必殺シュート。                           | A super special move created by DAISUKE                     |
| that unites the will of all 11 players.                      | `0x51608C2C`                                                |
| **Un long tir apaisant qui trace                             |
| un arc-en-ciel sur son passage.**                            | シュートの軌道でフィールドに虹をかける                      |
| 癒やし系ロングシュート。                                     | A restorative long shot that paints a rainbow over          |
| the pitch.                                                   | `0x487BBD6D`                                                |
| **La balle, enveloppée d'une aura surnaturelle,              |
| détruit tout sur son passage d'une rotation ultra-rapide.**  | ボールの周囲に　ブラックホールを作り                        |
| 地面を削り取りながら地を這うように進む。                     | Infuse the ball with multidimensional                       |
| energies to travel at high speeds                            |
| with a destructive rotational force.                         | `0x987B6C13`                                                |
| **Dominez le terrain grâce à cette frappe                    |
| transperçant le but telle une étoile filante !**             | 銀河の彼方から　流星のごとく降りそそぐ                      |
| 宇宙のはじまりを思わせる壮大なシュート。                     | Dominate the pitch with a foreboding                        |
| threat reminiscent of the galaxy and                         |
| shoot with a comet-like high kick.                           | `0x81605D52`                                                |
| **Effectuez une rotation acrobatique avant                   |
| de frapper le ballon avec votre postérieur.**                | アクロバティックな動きで１回転し                            |
| 勢いそのまま　ヒップでボールを打つ合体技。                   | One player makes an acrobatic flip with the help of         |
| another and uses the momentum to strike the ball             |
| with the hip.                                                | `0xAA4D0E91`                                                |
| **Libérez toute la puissance contenue dans chaque            |
| mouvement. Une technique ultime que seuls les                |
| experts en kung-fu peuvent maîtriser.**                      | 型の一つ一つに力を込めて　解き放つ。                        |
| クンフーの達人だけが習得できる　匠の技。                     | Each move is charged with power, then unleashed.            |
| A master's skill learned only by kung fu experts.            | `0xB3563FD0`                                                |
| **Frappez deux fois le ballon avant d'exécuter un tir        |
| des deux pieds d'une puissance phénoménale.**                | 両足で蹴り　２倍のパワーを蓄えたボールを                    |
| 弾丸のような勢いで発射するドロップキック。                   | Drop kick the ball with both feet for double the            |
| power and send it flying like a rapid bullet.                | `0xFC17A917`                                                |
| **Pivotez avec le ballon et faites une tête étourdissante    |
| qui envoie directement le ballon dans les buts.**            | ボールと一緒にクルクル回って頭でキック！                    |
| これぞクルクルヘディングシュート。                           | Spin with the ball and strike a dizzying                    |
| header straight at the goal.                                 | `0xE50C9856`                                                |
| **Le lien qui unit les deux joueurs fait souffler            |
| le vent révolutionnaire de la victoire.**                    | ２人の絆が　勝利という革命の風を起こす。                    |
| 友情パワーの必殺シュート。                                   | The bond of friendship between two players stirs up         |
| victorious winds of change.                                  | `0xCE21CB95`                                                |
| **Frappez le ballon du genou et renvoyez-le                  |
| vers le sol d'un puissant coup de talon.**                   | 膝でボールを蹴り上げて　かかとで落とす。                    |
| アクロバティックでクールな足業シュート。                     | Kick the ball up with your knee and                         |
| hammer it down with a sharp heel kick.                       | `0xD73AFAD4`                                                |
| **Invoquez un pouvoir draconique dans vos jambes             |
| et envoyez un tir latéral flamboyant vers les buts.**        | ドラゴンのパワーを両脚に込めて撃ち放つ                      |
| 炎のジャンピングサイドキック。                               | Channel draconic power into your legs                       |
| and blast a fiery sidekick at the goal.                      | `0x50A2E61B`                                                |
| **Un tir exécuté après une série de passes                   |
| ultrarapides qui donnent l'impression                        |
| que le ballon s'est dédoublé.**                              | 目にも止まらぬ速さで交わされる高速パスで                    |
| ボールが分身して見える　トリックシュート。                   | The ball is passed between two players at high speed        |
| until it seems to split into two.                            | `0x49B9D75A`                                                |
| **Le hurlement du loup sous le clair de lune                 |
| se transforme en un tir vif, mugissant sur le terrain.**     | 月光に照らされた狼の咆哮が                                  |
| 鋭いシュートとなってフィールドに轟く。                       | The howling of a wolf, illuminated by moonlight,            |
| manifested as a pinpoint shot that roars across the pitch.   | `0x9A3DD24A`                                                |
| **Technique secrète interdite invoquant de féroces           |
| manchots qui vous picorent la jambe avant de                 |
| pousser le ballon.**                                         | 獰猛なペンギンたちが　足を激しくついばむ。                  |
| 封印されし　禁断の究極奥義。                                 | A forbidden ultimate technique that unleashes               |
| penguins who peck at feet with savage force.                 | `0x8326E30B`                                                |
| **Toutes les roses ont des épines. Un tir spécial            |
| envoûtant exécuté avec des mouvements gracieux.**            | 綺麗な薔薇にはトゲがある。                                  |
| 華麗な動きで繰り出す　魅惑の必殺シュート。                   | Every beautiful rose hides its thorns.                      |
| Graceful moves unleash this bewitching shot.                 | `0xA80BB0C8`                                                |
| **Utilisez vos coéquipiers comme un club de golf             |
| pour un trou-en-un qui renverse le cours du jeu.**           | 味方の選手をクラブに見立てて振り抜く                        |
| 一発逆転ホールインワンショット。                             | Swing your teammates like a club for a                      |
| measured, hole-in-one strike.                           | `0xB1108189`                                                |
| **Un Tir fatal en duo dévastateur,                           |
| qui martèle les buts sous                                    |
| une pluie de frappes implacables.**                          | ２人なら　百烈ショットの威力も２倍？                        |
| 怒濤の連続キックがゴールを貫く。                             | A blistering two-man Wrath Shot barrage that                |
| hammers the goal with relentless strikes.                    | `0xFE51174E`                                                |
| **Ouvrez un portail spatial à vos pieds et exécutez          |
| un tir enveloppé d'une aura en forme de lance.**             | 足元に宇宙空間へつながるポータルを開き                      |
| 槍状のオーラをまとったシュートを放つ。                       | Open a portal to outer space on the ground to               |
| unleash a shot surrounded by a lance-shaped aura.            | `0xE74A260F`                                                |
| **Déchirez le terrain tel un dragon                          |
| qui dévore la terre sur son chemin jusqu'aux buts.**         | 地を這うドラゴンさながらに                                  |
| 大地を削りながら　ゴールに食らいつく。                       | Tear across the pitch like a dragon devouring               |
| the earth on its way to the goal.                            | `0xD57C448D`                                                |
| **Trois joueurs combinent leurs forces pour invoquer         |
| Pégase, qui s'élève dans le ciel tel un tourbillon,          |
| puis exécutent un puissant tir.**                            | 交差した３人の力が　ペガサスを呼び出し                      |
| 天高くから　竜巻のようなシュートを放つ。                     | Three players combine powers to summon                      |
| a Pegasus that rides to the goal from mid-air in a           |
| stormy hurricane.                                            | `0x52E45842`                                                |
| **Combinez la puissance des techniques Foudre                |
| et Trampoline du tonnerre pour permettre à deux              |
| coéquipiers de réaliser un tir surpuissant.**                | 大きな体を踏み台にして　２人が飛び上がる                    |
| イナズマ１号とイナズマ落としの合体技。                       | Two players use a large player's body as a springboard      |
| to combine Inazuma-1 and Inazuma Drop.                       | `0x4BFF6903`                                                |
| **Non, ce n'est pas une main,                                |
| mais bien un tir d'une énergie phénoménale.**                | これはハンドではない。シュートだ！                          |
| 莫大なエネルギーでボールを打ち出す。                         | This isn't a handball, it's a kick!                         |
| After gathering an enormous amount of                        |
| energy, take aim, and shoot!                                 | `0x9BFFB87D`                                                |
| **Frappez le ballon d'une tête vers le bas,                  |
| puis enchaînez avec une volée en pleine                      |
| descente pour plus de puissance.**                           | パワーを込めたヘディングとボレーを合わせ                    |
| 稲光と共にボールを放つ連携技。                               | Power up a mighty header and strike the ball                |
| with a lightning-fast downward volley.                       | `0x82E4893C`                                                |
| **Prenez votre envol tel un aigle royal                      |
| et assénez un redoutable double tir.**                       | オオワシのように空中を飛び交い                              |
| 強力なツインシュートをお見舞いする。                         | Two players soar up like eagles to deliver a                |
| powerful twin shot from mid-air.                             | `0xA9C9DAFF`                                                |
| **Une synchronisation parfaite transforme                    |
| la force cumulée en papillons,                               |
| déstabilisant ainsi l'adversaire.**                          | 息ピッタリな２人が手を取り合えば                            |
| 重なり合った力が　蝶となって敵を惑わす。                     | Like a butterfly's flapping wings,                          |
| two perfectly in sync players combine their powers           |
| and put the opposition in a trance.                          | `0xB0D2EBBE`                                                |
| **Ouvrez un portail dimensionnel à l'aide d'un               |
| coéquipier puis décochez ensemble un tir                     |
| empreint d'énergie cosmique.**                               | ダブルキックの衝撃で宇宙空間を生み出し                      |
| エネルギーを打ち出す　コズミックシュート。                   | A double kick opens up a dimension to outer space           |
| and the energy is harnessed for a shot of cosmic             |
| strength.                                                    | `0xFF937D79`                                                |
| **Trois joueurs brisent la terre pour envelopper             |
| le ballon dans des roches avant d'exécuter une               |
| frappe destructrice à l'unisson.**                           | ３人のオーラで大地を砕き　作った岩の塊を                    |
| ボールと共に打ち砕く　破壊的シュート。                       | Three players' auras smash the ground apart.                |
| Ball and boulder explode in a brutal strike.                 | `0xE6884C38`                                                |
| **Prêt à sacrifier vos lunettes, exécutez                    |
| une technique désespérée pour changer                        |
| la trajectoire du ballon avec votre visage.**                | メガネが壊れても構わない。                                  |
| 顔面でボールの軌道を変える　捨て身の技。                     | Who cares if your glasses break? It's worth it              |
| if it makes the ball change trajectory!                      | `0xCDA51FFB`                                                |
| **Un Tir puissance 2 devenu encore plus destructeur          |
| en le combinant avec la Tornade de feu.**                    | ファイアトルネードとの連携で                                |
| 破壊力がさらにアップしたツインブースト。                     | A combo move that works together with Fire Tornado          |
| by boosting its power.                                       | `0xD4BE2EBA`                                                |
| **Combinez Tornade inversée et Tornade de feu                |
| pour un tir qui part en tournoyant vers le ciel.**           | 螺旋の軌道で突き進む　バックトルネードと                    |
| ファイアトルネードの合体技。                                 | Combine spinning Back and Fire Tornadoes                    |
| into a strike that swirls onward.                            | `0x53263275`                                                |
| **Tir aux flammes écarlates lors duquel                      |
| la balle est habitée de la puissance détonante du soleil.**  | 爆発的な太陽の力がボールに宿り                              |
| 紅蓮の炎で焼き尽くす灼熱のシュート。                         | Imbue the ball with explosive solar                         |
| energy and fire off a shot engulfed in crimson flames.       | `0x4A3D0334`                                                |
| **Une combinaison qui garantit un but                        |
| en plaçant quatre verrous sur le ballon.**                   | 放ったボールに４本のロックをかけて                          |
| 確かなゴールを保障する合体技。                               | Flick the ball up and lock it with four keys to             |
| secure a straight path to the goal.                          | `0x90A3FF40`                                                |
| **Technique ultime achevée par Genesis.                      |
| Sa puissance dépasse toute dimension footballistique.**      | ジェネシスが完成させた最強クラスの技。                      |
| そのパワーはサッカーの次元を超えている。                     | The strongest of moves perfected by The Genesis.            |
| Its power far exceeds the boundaries of football             |
| known to man.                                                | `0x89B8CE01`                                                |
| **Tir synchronisé de manchots en combinaison spatiale !      |
| Transperçant l'atmosphère, ils visent le but.**              | 宇宙服のペンギンが地上から一斉に発射！                      |
| 大気圏を突っ切り　ゴール到達を目指す。                       | Launch penguins equipped with spacesuits off into space,    |
| who'll reenter the atmosphere and go for the goal!           | `0xA2959DC2`                                                |
| **Une version améliorée du Choc du dragon empruntant         |
| la vitesse et la puissance d'une vouivre.**                  | ワイバーンの力とスピードを併せ持つ                          |
| ドラゴンクラッシュの進化版シュート。                         | An improved version of Dragon Crash that combines           |
| the Wyvern's speed and power.                                | `0xBB8EAC83`                                                |
| **Une puissante attaque combinant                            |
| le Choc de la vouivre au Blizzard éternel.**                 | ワイバーンクラッシュと                                      |
| エターナルブリザードが合体した強力な一撃。                   | A powerful strike combining the Wyvern Crash                |
| and Eternal Blizzard.                                        | `0xF4CF3A44`                                                |
| **Le feu s'allie à la glace dans ce double tir ultime        |
| pour former un tourbillon dévastateur.**                     | 氷と炎　相反する２つのエネルギーが交差し                    |
| 渦となって放たれる　究極のダブルシュート。                   | This double shot pits the opposing powers of ice            |
| and fire against each other to form a swirling               |
| vortex.                                                      | `0xEDD40B05`                                                |
| **Le ballon se transforme en véritable                       |
| phénix des ténèbres, d'une puissance largement               |
| supérieure à l'original.**                                   | 闇をまとったボールが　フェニックスに変化！                  |
| そのパワーはオリジナルを上回る。                             | Transform a ball surrounded by dark aura into a             |
| phoenix to amplify its original power.                       | `0xC6F958C6`                                                |
| **Trois joueurs courent en ligne droite et accélèrent        |
| progressivement pour exécuter un tir long.**                 | ３人が直線上に駆け抜け　シュートをつなぐ                    |
| 段階式にスピードアップするロングシュート。                   | Three players run in a straight line and kick the           |
| ball to the one ahead to create a triple-boosted             |
| long shot.                                                   | `0xDFE26987`                                                |
| **Connectez votre volonté à celles de deux                   |
| coéquipiers et tirez si fort que le ciel en tremble.**       | ３人の熱い思いで　大気圏を突き破り                          |
| 地球を破壊するほどの　強烈シュートを放つ。                   | Link your resolve with two teammates and                    |
| launch a shot powerful enough to shake the heavens.          | `0x587A7548`                                                |
| **Expédiez le ballon tel un missile inarrêtable              |
| qui viendra marteler les buts adverses.**                    | ミサイルと化したボールが                                    |
| 雨あられのごとく　ゴールへと降り注ぐ。                       | Launch the ball like a relentless missile,                  |
| hammering the goal nonstop.                                  | `0x41614409`                                                |
| **Une technique ultime qui fascine même les dieux,           |
| dont les ailes dorées sont d'une beauté                      |
| à couper le souffle.**                                       | その黄金の翼は　息を呑むほどに美しい。                      |
| 神すらも魅了する　神々しい究極奥義。                         | A divine ultimate technique that uses brilliantly           |
| beautiful golden wings that captivate even the gods.         | `0x91619577`                                                |
| **Un tir de la tête créant un poing géant qui                |
| frappe le ballon pour l'envoyer vers le but.**               | 頭上に掲げた巨大な右手で                                    |
| パンチを繰り出す　ヘディングシュート。                       | Launch a header, hitting the ball with a giant hand         |
| raised above the head.                                       | `0x887AA436`                                                |
| **Un tir lobé dévastateur qui fait monter le ballon          |
| vers le ciel, puis le fait retomber en piqué                 |
| tournoyant.**                                                | 天に向かってボールが上昇　スピンしながら                    |
| 急降下する　スーパードライブシュート。                       | The ball flies high up into the air and plunges             |
| down at high speed while spinning.                           | `0xA357F7F5`                                                |
| **Impact violent amenant le gardien au sol.                  |
| Une aurore boréale transperce les défenses ennemies.**       | キーパーを凍土へと誘う　極限の一撃。                        |
| 力を宿したオーロラが　敵陣を貫く。                           | An ultimate attack that imprisons the keeper in permafrost. |
| The power dormant in the aurora                              |
| breaks the opposing ranks.                                   | `0xBA4CC6B4`                                                |
| **L'eau s'allie à la glace dans ce double tir ultime         |
| pour former un tourbillon dévastateur.**                     | 炎と氷　相反する２つのエネルギーが交差し                    |
| 渦となって放たれる　究極のダブルシュート。                   | Opposing fire and ice crash into one                        |
| to form a swirling vortex double strike.                     | `0xF50D5073`                                                |
| **Deux auras croisées tourbillonnent violemment              |
| pour exécuter un tir combiné capable de faire                |
| vibrer les étoiles.**                                        | クロスした２つのオーラが　激しく渦巻く。                    |
| 星を揺るがすほどの威力を誇る合体シュート。                   | Two players' auras cross and swirl violently,               |
| unleashing a stunningly powerful combo shot.                 | `0xEC166132`                                                |
| **Votre imposante posture laisse entrevoir un tigre          |
| gigantesque qui guette sa proie.**                           | 獲物を狙うかのような　重厚な構えにより                      |
| 背後に巨大なトラの幻影が見えるという。                       | Crouch down like a predator hunting prey until the          |
| illusion of a tiger can be seen behind the player.           | `0xC73B32F1`                                                |
| **La grandiose aura qui émane de votre jambe                 |
| droite se change en une gigantesque épée                     |
| qui fend le terrain en deux.**                               | 振り上げた右足に宿る気高きオーラが                          |
| 巨大な剣となって　フィールドを両断する。                     | A noble aura engulfs the player's raised right foot,        |
| forming a massive blade that cleaves the field.              | `0xDE2003B0`                                                |
| **Une frappe spéciale ultrarapide qui enveloppe              |
| le ballon de flammes incandescentes.**                       | キックの威力で　ボールに地獄の火を点す。                    |
| イグニッションスタートの必殺シュート。                       | A special move that ignites the ball with hellfire          |
| through a powerful kick.                                     | `0x59B81F7F`                                                |
| **Surfez sur une vague déchaînée et élevez-vous              |
| vers le ciel pour tirer depuis l'œil du typhon !**           | 大荒れの海を制覇した勢いで　上昇して                        |
| 台風の目から発射される暴風ショット！                         | Rise with a force that could conquer raging seas            |
| and fire a storm shot from the eye of the typhoon!           | `0x40A32E3E`                                                |
| **Version améliorée du Trampoline du tonnerre.               |
| Ce retourné acrobatique est si puissant                      |
| qu'il provoque une tornade.**                                | イナズマ落としのニューバージョン。                          |
| ２人の力で竜巻を起こす　オーバーヘッド。                     | New version of Inazuma Drop where two players work          |
| together to execute a whirlwind bicycle kick.                | `0x260CC99D`                                                |
| **Reprise de volée qui invoque une bête électrique.          |
| Augmente la puissance de tir du coéquipier.**                | 雷獣を呼ぶ　ジャンピングサイドキック。                      |
| 仲間のシュートをブーストアップする。                         | A jumping side volley that summons a thunder beast.         |
| Used to boost a teammate's shot.                             | `0x3F17F8DC`                                                |
| **Une technique spéciale combinant les pouvoirs de           |
| la Tempête de feu et de la Frappe du tigre.**                | 爆熱ストームとタイガードライブの                            |
| ２つのパワーを合体させた　強烈な必殺技。                     | Deadly special move that combines the power of              |
| Fireball Storm and Tiger Drive.                              | `0x143AAB1F`                                                |
| **Un puissant tir qui allie force et majesté,                |
| tel un dragon bleu rugissant aux ailes déployées.**          | 巨大な翼を広げた　青き竜王が咆哮する。                      |
| パワーと威厳を兼ね備えた　強烈な一撃。                       | A blue dragon king spreads its wings and roars,             |
| unleashing a fierce yet majestic attack.                     | `0x0D219A5E`                                                |
| **Sept épées brillantes fendent                              |
| les airs et foncent droit vers le but.**                     | ７つの輝く剣が　空を切り裂きながら                          |
| 一直線にゴールへと迫るシュート技。                           | Seven glowing swords rip through the air hurtling           |
| toward the goal.                                             | `0x42600C99`                                                |
| **Sifflez pour faire appel à des manchots qui                |
| dessinent un cercle d'énergie propulsant le tir.**           | 指笛を吹いて　ペンギンたちを召喚し                          |
| サークルを描いてエネルギーを集める。                         | Summon a penguin huddle by whistling, and gather            |
| energy as they circle around.                                | `0x5B7B3DD8`                                                |
| **La force combinée de trois joueurs ressuscite le           |
| légendaire Fenrir qui rugit en fonçant vers le but.**        | ３人の力が　伝説のフェンリルを蘇らせる。                    |
| 咆哮がゴールを引き裂く　獣の一撃。                           | Three players come together to revive the legendary         |
| Fenrir, whose bestial roar tears through the goal.           | `0x70566E1B`                                                |
| **Dessine un cercle magique au sol et invoque                |
| l'aura de l'épée d'Odin pour transpercer le but.**           | 地面に描かれた魔法陣から　呼び出された                      |
| オーディンソードのオーラでゴールを貫く。                     | Penetrate the goal using the aura of Odin's sword,          |
| summoned via a magic circle on the ground.                   | `0x694D5F5A`                                                |
| **Le ballon fonce vers le ciel et s'enveloppe                |
| de lumière avant de s'abattre brusquement                    |
| tel un châtiment divin.**                                    | 天に向かって上昇したボールが光をまとい                      |
| 天罰を下すかのように　鋭く急降下する。                       | The ball rises into the clouds and descends sharply,        |
| surrounded by light, as if dealing out divine                |
| punishment.                                                  | `0xEED54395`                                                |
| **Donnez de l'effet au ballon grâce à un jeu de jambes       |
| prodigieux, puis frappez-le au rythme de la samba.**         | 華麗な足さばきで　ボールに回転を与えて                      |
| サンバのリズムで打ち出すトリッキーな技。                     | Add spin to the ball using fancy footwork and shoot         |
| to a Samba beat.                                             | `0xF7CE72D4`                                                |
| **Deux forces portées à leurs limites fusionnent             |
| pour créer un nouvel ADN de puissance pure.**                | 極限まで高められた　２つのパワーを融合し                    |
| 新たなるパワーを宿したＤＮＡを生み出す。                     | Two extremely heightened powers fuse together to            |
| create the DNA of a new move.                                | `0x27CEA3AA`                                                |
| **Un tir spécial rappelant la naissance de l'univers,        |
| dont la puissance explosive est amplifiée par                |
| la collaboration des trois joueurs.**                        | ３人の連携で　威力を爆発的に増幅させる                      |
| 宇宙の誕生をも思わせる　必殺シュート。                       | This special move has three players working together        |
| to add explosive cosmic power to the shot.                   | `0x3ED592EB`                                                |
| **Un tir surpuissant aussi violent qu'un                     |
| ouragan, mêlant blizzard et tempête.**                       | ブリザードとストームをミックスした                          |
| ハリケーン級に強烈な　超破壊力のシュート。                   | Mix a blizzard and storm together to generate an            |
| ultra-destructive hurricane shot.                            | `0x15F8C128`                                                |
| **Un requin géant surgit des vagues déchaînées               |
| pour foncer sur le gardien adverse.**                        | 荒れ狂う波の中から　姿を現した巨大ザメが                    |
| 相手のゴールキーパーに襲いかかる。                           | A giant shark appears from among raging waves and           |
| attacks the opposing team's goalkeeper.                      | `0x0CE3F069`                                                |
| **Concentrez toute votre puissance dans                      |
| vos orteils pour exécuter un pointu                          |
| émettant une noble aura.**                                   | 体のパワーを　すべて爪先に集中させて                        |
| 気高き光を放つ　渾身のトゥーキック。                         | All body power flows into a single toe.                     |
| A dazzling light erupts with the mighty toe kick!            | `0x43A266AE`                                                |
| **Faites tournoyer le ballon sur le côté, pour qu'il         |
| trace une courbe parfaite rappelant une banane,              |
| directement vers les buts.**                                 | 横方向に回転をかけて　バナナのように                        |
| キレイな曲線を描きながら飛ぶシュート。                       | Send the ball spinning sideways, bending through            |
| the air in a clean banana-curve toward the goal.             | `0x5AB957EF`                                                |
| **Un banana kick ramassé qui surfe sur la vague              |
| et surgit du tube pour foncer vers le but.**                 | ボールのうねりで　チューブ状の海流を生み                    |
| 選手たちの波をくぐり抜けてゴールを目指す。                   | A gnarly curve shot that rides the waves and                |
| surges through the water tube straight for the goal.         | `0x7194042C`                                                |
| **Prenez le ballon entre vos pieds, puis effectuez           |
| une frappe avec effet pour le propulser à la vitesse         |
| de la lumière.**                                             | 両足で挟んだボールにスピンをかけて                          |
| 上空から銃弾のように撃ち込む高速シュート。                   | Twist the ball between both feet to add a spin that         |
| causes it to hurtle down from above like a bullet.           | `0x688F356D`                                                |
| **Tir exécuté au milieu de flammes                           |
| tourbillonnantes capables de tout brûler                     |
| instantanément.**                                            | 渦巻く炎をまといながら　シュートを放つ。                    |
| その火力は　一瞬ですべてを焦がすほど。                       | Shoot the ball at the goal while surrounded by              |
| whirling flames that burn everything up instantly.           | `0xEF1729A2`                                                |
| **Tel un mirage, ce tir magique déforme l'espace pour        |
| donner l'illusion que le ballon est divisé en deux.**        | 蜃気楼で空間をゆがめて　ボールが２つに                      |
| 分裂したかのように見せる　幻惑シュート。                     | A mesmerizing illusion shot where a mirage                  |
| makes it look like the ball splits into two.                 | `0xF60C18E3`                                                |
| **Un cœur débordant de confiance est capable d'invoquer      |
| Pégase. Version solo du Tri-Pégase.**                        | 自らを信じる心が　ペガサスを呼ぶ。                          |
| トライペガサスの１人バージョン。                             | Faith in yourself summons a Pegasus.                        |
| This is the solo version of Tri-Pegasus.                     | `0x25881DF3`                                                |
| **Deux joueurs exécutent une double volée synchronisée       |
| invoquant une licorne qui fonce vers le but.**               | ２人の息を合わせたツインボレーで                            |
| ユニコーンを呼び出し　ゴールヘと突進する。                   | Two players volley in unison to summon a unicorn            |
| that charges straight for the goal.                          | `0x3C932CB2`                                                |

---

## 4. Personnages Phares & Équipes Légendaires (Lore & Données VFS)

### 4.1. Fiche Canonique : Byron Love (亜風炉 照美 / Aphrodi)

- **Identité Globale :** Byron Love (FR / EN) — 亜風炉 照美 (あふろ てるみ) — Surnom : アフロディ (Aphrodi).
- **CharaID VFS :** `0x37D7ACFB` | **Mesh Modèle :** `c01001010` (coiffure `_hairF`).
- **Élément :** Bois / Forêt (木・林) | **Positions Principales :** Milieu de Terrain (MF) / Attaquant (FW).
- **Profil Statistique (Héros / BASARA Lv99) :**
  - **Tir (Kick) :** 238 | **Contrôle :** 258 | **Technique :** 250
  - **Physique :** 210 | **Pression :** 211 | **Agilité :** 195 | **Intelligence :** 230
- **Lore & Parcours Scénaristique :**
  - Capitaine incontesté du **Collège Zeus (世宇子中)** lors du tournoi Football Frontier originel, incarnant l'arrogance et la beauté du football divin sous l'égide de Ray Dark.
  - Rédemption flamboyante en rejoignant temporairement le **Collège Raimon** pour briser les défenses de Diamond Dust lors de la menace Alius.
  - Leader de l'équipe nationale coréenne **Fire Dragon** aux côtés de Bryce Whitingale (Gazelle) et Claude Beacons (Torch) lors du tournoi FFI.

### 4.2. Les Piliers Historiques de la Saga

| Personnage (FR)    | Personnage (JA)              | Personnage (EN) | Équipe Origine         | Rôle & Techniques Emblématiques                                                              |
| ------------------ | ---------------------------- | --------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| **Mark Evans**     | 円堂 守 (Endo Mamoru)        | Mark Evans      | Collège Raimon         | Gardien légendaire, capitaine né. _God Hand_, _Majin The Hand_, _Fist of Justice_.           |
| **Axel Blaze**     | 豪炎寺 修也 (Gouenji Shuuya) | Axel Blaze      | Collège Raimon         | Buteur de génie au tir de feu dévastateur. _Fire Tornado_, _Bakunetsu Storm_.                |
| **Jude Sharp**     | 鬼道 有人 (Kidou Yuuto)      | Jude Sharp      | Royal Academy / Raimon | Meneur de jeu stratège aux lunettes distinctives. _Inazuma Break_, _Emperor Penguin No.2_.   |
| **Unmei Sasanami** | 笹波 雲明                    | Unmei Sasanami  | Collège Nagumohara     | Protagoniste de _Victory Road_, stratège sans capacités physiques dirigeant par la tactique. |
| **Haru Endo**      | 円堂 ハル                    | Haru Endo       | Collège Raimon         | Fils de Mark Evans, génie invincible régnant au sommet du football lycéen.                   |

### 4.3. Échantillon d'Équipes Indexées (FR / JA / EN)

| Équipe (FR)                                                                             | Équipe (JA)                                                            | Équipe (EN)                                       | Hash VFS     |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- | ------------ |
| **1章チュートリアル試合 北洋学園**                                                      | 1章チュートリアル試合 北洋学園                                         | 1章チュートリアル試合 北洋学園                    | `0x47783299` |
| **1章チュートリアル試合 雷門中**                                                        | 1章チュートリアル試合 雷門中                                           | 1章チュートリアル試合 雷門中                      | `0xDE716323` |
| **Description 1 du club de football Nagumo Hara.**                                      | 南雲原サッカー部の説明文１。                                           | Description 1 of the Nagumo Hara Soccer Club.     | `0x9DF6F9FC` |
| **Description 2 du club de football Nagumo Hara.**                                      | 南雲原サッカー部の説明文２。                                           | Description 2 of the Nagumo Hara Soccer Club.     | `0x04FFA846` |
| **Une équipe formée récemment. Ils ont utilisé des tactiques futées                     |
| pour atteindre le Football Frontier et renverser des équipes de prestige.**             | 発足からわずかな期間で　フットボールフロンティアに出場した。           |
| 名采配によって　名門校や強豪校を下してきた期待の新鋭。                                  | A rising team formed recently, they used smart tactics to              |
| break into Football Frontier and topple prestigious teams.                              | `0x73F898D0`                                                           |
| **Leur entraînement intelligent affine la vision tactique de tous les joueurs           |
| et leur a valu le surnom de « Northbright au Foot Parfait. »**                          | 合理的な教育プログラムによって　全員の戦術眼が高められている。         |
| 個々の選手の能力が高く『パーフェクトサッカーの北陽』と言われる。                        | Their smart training sharpens every player's tactical vision,          |
| earning them the nickname "Perfect Football Northbright."                               | `0x96121521`                                                           |
| **Un établissement rival de NAGUMOHARA,                                                 |
| ils se sont grandement améliorés après l'arrivée d'une manageuse de talent.**           | 南雲原と並ぶ九州屈指の進学校で　古くからライバル関係にある。           |
| 優秀なマネージャーが入ったことで　実力が大幅にアップした。                              | A top academic rival to NAGUMOHARA,                                    |
| they surged forward once a skilled coordinator joined their ranks.                      | `0x781C740D`                                                           |
| **Ils prennent le risque d'utiliser des Keshin malgré l'impact qu'ils ont,              |
| ce qui rend leur tactique rare et difficile à contrer.**                                | 体力的なリスクから　あまり使われなくなった化身をあえて使う。           |
| その希少性からか　どの学校も対策に苦労させられている。                                  | They risk using Keshin despite the toll it takes,                      |
| making their tactic rare and tough for others to counter.                               | `0xE678E1AE`                                                           |
| **Menés par un prodige surnommé « Alice au terrain des merveilles »,                    |
| ils dominent avec un travail d'équipe exemplaire et d'excellentes tactiques.**          | 『不思議なフィールドのアリス』と呼ばれる天才少年監督が率いる。         |
| 徹底的な組織プレイと　完璧な戦術で他を寄せ付けない。                                    | Led by a prodigy dubbed "Alice in Footballand,"                        |
| they dominate with flawless teamwork and perfect tactics.                               | `0x917FD138`                                                           |
| **École pour filles de Kumamoto au travail d'équipe parfait.                            |
| Personne ne sait qui dirige. On raconte qu'il y a une « reine des abeilles ».**         | 熊本の女子校。完璧で組織的なプレイをするが　誰が指示役か不明。         |
| そのため　謎の司令塔『女王蜂』がいるという都市伝説が生まれた。                          | A girls' school in Kumamoto with perfect teamwork.                     |
| Nobody knows who leads, sparking rumors of a secret "Queen Bee."                        | `0x08768082`                                                           |
| **Ces deux collèges de Fukuoka ont fusionné en cette équipe.                            |
| Plein de joueurs à l'air coriace, mais c'est pour éviter d'être expulsés de force.**    | 福岡の２つの学校が合併してできた。不良っぽい生徒が多いが               |
| 実は立ち退きを迫る大人に対抗するための　キャラ付けらしい。                              | Two Fukuoka schools merged into this team. Lots of tough-looking kids, |
| but it's just an act to push back against forced evictions.                             | `0x7F71B014`                                                           |
| **Cette équipe s'est formée à partir de voyous de NAGUMOHARA.                           |
| À la mort de leur ancien entraîneur, il a nommé son chien comme successeur.**           | 南雲原町のガラの悪い連中が　徒党を組んで生まれたチーム。               |
| 監督であった先代が亡くなる際　なぜか飼い犬に跡目を継がせた。                            | A gang of rough kids from NAGUMOHARA formed this team. When            |
| their old manager died, he bizarrely named his dog as his successor.                    | `0xEFCEAD85`                                                           |
| **Un groupe de commerçants de NAGUMOHARA qui n'abandonne jamais.                        |
| Ils ont une endurance quasi infinie, et sont plus forts qu'on le croit.**               | 南雲原町の商店街の店主たちが　集まって作ったサッカーチーム。           |
| メンバーは皆　繁盛店のため体力だけはあり　なかなか手強い。                              | A gritty squad of NAGUMOHARA shop owners who never quit.               |
| Their stamina's off the charts, and they're tougher than you'd expect.                  | `0x98C99D13`                                                           |
| **Installé dans une crique, ce groupe de primaires joue                                 |
| comme des pros. Beaucoup ont le niveau de collégiens.**                                 | 入り江の浜辺を拠点に活動する　小学生を中心としたグループ。             |
| 中学生も顔負けのプレイをする子も多く　レベルはかなり高い。                              | Based around a seaside inlet, this group of grade-schoolers plays      |
| like pros. Many could easily go toe-to-toe with middle schoolers.                       | `0xF80E14F6`                                                           |
| **Des enfants venus d'un village touristique en déclin, au pied des                     |
| montagnes de Saga. Ils sont sympathiques, mais leurs sourires le sont moins.**          | 佐賀にある山のふもとの観光地で　過疎と戦う村の少年少女たち。           |
| 観光客対策で愛想はいいが　その笑顔にはどこか不気味さがある。                            | Kids from a dying tourist village at the foot of Saga's mountains.     |
| While friendly to visitors, their smiles have a creepy edge.                            | `0x8F092460`                                                           |
| **Une équipe remplie d'internationaux connue comme étant la meilleure du Kyushu,        |
| avec des joueurs plus musclés et forts que des lycéens.**                               | 様々な国からの留学生が在籍した国際チームで　九州最強と名高い。         |
| 体格においては　高校級以上の選手がそろっている。                                        | A top international squad known as Kyushu's strongest, packed          |
| with players bigger and tougher than most high school teams.                            | `0x160075DA`                                                           |
| **Année après année, ils dominent le Football Frontier sans jamais perdre.              |
| Dotés de talents d'élite, et aidés par un entraînement quasi-pro.**                     | 毎年のように　フットボールフロンティアを制する無敗の王者。             |
| 日本中から逸材が集まり　プロの指導者による一流の練習が行われる。                        | Year after year, they dominate the Football Frontier undefeated,       |
| full of elite talent and backed by pro-level training.                                  | `0x6107454C`                                                           |
| **Ils créent des stratégies précises pour chaque adversaire.                            |
| En absence de modèle précis, leur flexibilité est la clé de leur force.**               | 南雲原サッカー部の特出点テキスト１。                                   | They tailor diverse strategies to every opponent. |
| With no fixed patterns, staying flexible is essential.                                  | `0x86EAF292`                                                           |
| **南雲原サッカー部の特出点テキスト２。**                                                | 南雲原サッカー部の特出点テキスト２。                                   | 南雲原サッカー部の特出点テキスト２。              | `0x1FE3A328` |
| **Ils créent des stratégies précises pour chaque adversaire.                            |
| En absence de modèle précis, leur flexibilité est la clé de leur force.**               | 相手のチームに合わせて　多種多様な戦略を駆使してくる。                 |
| 定番のパターンが存在しないため　臨機応変な対応力が求められる。                          | They tailor diverse strategies to every opponent.                      |
| With no fixed patterns, staying flexible is essential.                                  | `0x68E493BE`                                                           |
| **Ils se limitent à une formation quand ils changent de tactique                        |
| mais la formation SHINANO affaiblit leur défense qui devient moins synchro.**           | 複数の必殺タクティクスを使いこなすため　戦術を固定させる必要がある。   |
| シナノフォームは　ＤＦとＧＫが連携しないため防御力が落ちる。                            | They stick to one formation to handle shifting tactics,                |
| but the SHINANO Formation weakens defence and synergy.                                  | `0x8BBC0074`                                                           |
| **Une équipe qui n'a fondamentalement pas de faiblesses.                                |
| Un meneur de jeu donne le rythme, et leur gardien a une technique signature.**          | 基本に忠実なサッカーをするチームで　弱点らしい弱点はない。             |
| １人のゲームメイカーが要になっていて　キーパーは必殺技を持つ。                          | A fundamentally sound team with no clear weaknesses.                   |
| One playmaker runs the show, and the keeper has a signature move.                       | `0x65B26158`                                                           |
| **Deux Keshin créent une ligne défensive et offensive imparable.                        |
| Le seul moyen de se défendre, c'est d'avoir aussi un Keshin.**                          | ２つの化身が　攻防併せ持つ絶対的な戦術ラインを生み出している。         |
| 対抗するには　こちらも化身を使ってホットラインを断つしかない。                          | Two Keshin create an unstoppable offence-defence line.                 |
| The only way to fight back is with Keshin of your own.                                  | `0xFBD6F4FB`                                                           |
| **Ils utilisent de nombreuses tactiques offensives et défensives.                       |
| Pour vaincre leur stratégie parfaite, il faut être inventif et imprévisible.**          | 多彩な必殺タクティクスを有していて　攻守ともに隙が無い。               |
| 完璧な戦術を打ち破るには　相手に先を読ませない工夫が必要となる。                        | They use a wide variety of tactics on offence and defence.             |
| Beating their perfect strategy takes creativity and unpredictability.                   | `0x8CD1C46D`                                                           |
| **Leurs formations rappellent les abeilles ouvrières.                                   |
| Avec des passes précises et un contrôle parfait du ballon, elles maîtrisent le match.** | 洗練されたフォーメーションが　働きバチのように統率が取れている。       |
| パス回しの正確さに定評があり　ボールの支配率が高い。                                    | Their slick formation moves like a swarm of worker bees.               |
| Precise passing and tight ball control keep them in charge.                             | `0x15D895D7`                                                           |
| **Malgré les apparences, ils sont solidaires et travaillent bien ensemble.              |
| Un entraînement constant fait que leurs fondamentaux sont parfaits.**                   | 見た目に反してチームメイトの関係性は良好で　連携プレイに秀でている。   |
| たゆまぬ反復練習により　基礎的なプレイスキルが高い。                                    | Despite their rough look, they're tight-knit and work well together.   |
| Constant drills sharpen their basic skills.                                             | `0x62DFA541`                                                           |
| **Leur style brutal fait qu'ils ne jouent pas toujours selon les règles,                |
| mais quand le Second prend une décision, le match est renversé.**                       | ガラの悪さから　ラフプレイが目立つ傾向にあるが                         |
| 二代目の指示による必殺タクティクスで　戦況が大きく動くことがある。                      | Their rough style leads to plenty of dirty plays,                      |
| but when The Second calls the shots, the whole game can flip.                           | `0xF260B8D0`                                                           |
| **Ils jouent avec intensité et rapidité, ouvrent les défenses en deux                   |
| mais laissent des brèches quand ils retournent en défense.**                            | 豪快なプレイスタイルで　精細な動きはあまり向いていないが               |
| ボール保有時の突破力が高く　逆に防御は甘い傾向にある。                                  | They play hard and fast, smashing through defences                     |
| but leaving gaps when they're back on defence.                                          | `0x85678846`                                                           |
| **Ces enfants jouent bien au-dessus de leur niveau.                                     |
| Leur petite taille fait que leur endurance diminue au fil du match.**                   | どの選手も小学生とは思えないほど　サッカーのスキルが高い。             |
| 小柄で体力が少ないせいか　後半になるにつれスタミナ切れを起こす。                        | These kids play way above their grade-school level.                    |
| Small builds mean their stamina fades as the game goes on.                              | `0xE5A001A3`                                                           |
| **Élevés dans la campagne, ces joueurs ont énormément d'endurance.                      |
| Ils carburent en seconde mi-temps, alors prenez vite l'avantage.**                      | 田舎育ちのため　どの選手も体力には自信があり持久力に優れる。           |
| 特に後半に粘りを見せるため　前半で差をつけておきたい。                                  | Raised in the countryside, these players have solid endurance.         |
| They dig deep in the second half, so get ahead early.                                   | `0x92A73135`                                                           |
| **Grâce à leur physique et leurs instincts, ils font rarement appel à la tactique.      |
| Leur style prévisible peut être contré si on est malin.**                               | 全選手フィジカルもセンスも高いため　戦術を使用してこない。             |
| 行動が読めない反面　必殺タクティクスでの対抗が期待できる。                              | Strong and instinctive, they rarely rely on strategy.                  |
| Their unpredictable style can be countered with the right tactics.                      | `0x0BAE608F`                                                           |
| **Chaque joueur est titanesque, mais les rôles sont tellement répartis                  |
| que ça les rend faciles à lire. La clé, c'est de contrer leurs forces.**                | いずれもエース級の選手で　得意分野は特出して秀でているが               |
| 個性が明確で分析しやすいため　個々の能力をどう相殺するかが鍵になる。                    | Each player is a force to be reckoned with, but clear-cut roles        |
| make them easy to read. Countering their strengths is key.                              | `0x7CA95019`                                                           |
| **Les joueurs de baseball qui participaient au spectacle après les cours                |
| ont de l'expérience en foot, et sont en très bonne forme physique.**                    | 放課後のショーをやっていた野球部員は　いずれもサッカーの経験者。       |
| 強豪校の練習に裏打ちされた　確かな基礎体力を有している。                                | The baseball players who did the after-school show all come from       |
| football backgrounds, with solid fitness built by tough training.                       | `0xE2CDC5BA`                                                           |
| **Leur entraînement rigoureux et quotidien a renforcé leur force,                       |
| et une fois sur le terrain, leur vitesse est admirable.**                               | 日頃の過酷な練習により　フィジカルがかなり強化されている。             |
| 走塁により鍛えられた脚力は　決して侮れない。                                            | Their harsh daily training has boosted their physical strength,        |
| and their speed on the pitch is no joke.                                                | `0x95CAF52C`                                                           |
| **Une équipe de stars quasiment imbattable menée par un capitaine solitaire             |
| dont les plans méticuleusement élaborés s'effondrent au moindre faux pas.**             | 常に最適なプレイで対応するが　キャプテンが周りと連携をしない。         |
| 特出した能力を持つ選手だが　計算を狂わせるなら狙い目となる。                            | A nigh-unstoppable team of stars led by a lone-wolf captain,           |
| whose plans crumble if their carefully calculated plays are disrupted.                  | `0x0CC3A496`                                                           |
| **Chaque joueur met la pression rien qu'avec sa présence,                               |
| et est capable de faire changer le cours d'un match d'une simple technique décisive.**  | 各選手が勝負強く　かなりの存在感とプレッシャーを放っている。           |
| プレイ１つで　フィールドの空気をがらりと変えるほどの影響力を持つ。                      | Each player exudes pressure and presence,                              |
| capable of swinging the entire match with a single decisive move.                       | `0x7BC49400`                                                           |
| **Ils suivent les règles pour s'obtenir les faveurs de l'arbitre tout en repoussant     |
| complètement les tactiques violentes des adversaires pour dominer le terrain.**         | 徹底してラフプレイを行わないスタイルで審判を味方につけ                 |
| 相手の荒いプレイを完全に封じることで　行動を制限させる作戦を取る。                      | They play clean to win the referee's favor while completely            |
| shutting down opponents' rough tactics to dominate the field.                           | `0xEB7B8991`                                                           |
| **Maîtres quand il faut combiner différentes techniques spéciales,                      |
| leur travail d'équipe équilibré inspire le respect à tous les coins du terrain.**       | いくつもの必殺技を　巧みに組み合わせた戦術で勝負する。                 |
| バランスの取れた選手の動きに　一目を置かれている。                                      | Masters of combining multiple Special Moves, their balanced            |
| teamwork commands respect from every corner of the pitch.                               | `0x9C7CB907`                                                           |
| **Un club de l'ère de ENDO qui a failli                                                 |
| se séparer mais est entré dans la légende.**                                            | 廃部寸前の弱小サッカー部が優勝し                                       |
| 伝説となった　円堂守世代のチーム。                                                      | A club in ENDO's era that nearly                                       |
| split but instead became legends.                                                       | `0x732DE48B`                                                           |
| **Une équipe d'élite invaincue depuis 40 ans,                                           |
| sous le commandement de YUTO.**                                                         | ４０年間無敗の　サッカーの名門。                                       |
| 鬼道の指揮の元　統率の取れたプレイを行う。                                              | An elite team undefeated for 40 years,                                 |
| disciplined under YUTO's command.                                                       | `0xEA24B531`                                                           |
| **La meilleure équipe, menée par Aphrody.                                               |
| On dit que leur force est surhumaine.**                                                 | アフロディを中心とした最強チームで                                     |
| 人を超えた　神の領域とも呼ばれている。                                                  | The strongest team, led by Aphrody, is                                 |
| said to reach beyond-human levels.                                                      | `0x9D2385A7`                                                           |
| **Deuxième rang de l'Alius Academy.                                                     |
| Les premiers aliens arrivés sur Terre.**                                                | エイリア学園セカンドランク。                                           |
| 地球へ舞い降りた　宇宙人初の刺客。                                                      | Second rank of Alius Academy. The first                                |
| extraterrestrials to descend to Earth.                                                  | `0x03471004`                                                           |
| **Premier rang de l'Alius Academy. DEZARM mène                                          |
| une équipe douée mais surprenante.**                                                    | エイリア学園ファーストランク。                                         |
| キャプテンのデザームを中心に曲者が揃う。                                                | First rank of Alius Academy. DEZARM leads                              |
| a team of skilled, unusual players.                                                     | `0x74402092`                                                           |
| **Rang maître de l'Alius Academy.                                                       |
| Les meilleurs guerriers, au pouvoir inégalé.**                                          | エイリア学園マスターランク。                                           |
| 世界を支配する力を持つ　最強の戦士たち。                                                | Master rank of Alius Academy. The                                      |
| strongest warriors with world-ruling power.                                             | `0xED497128`                                                           |
| **Équipe nationale du Japon pour la coupe du monde                                      |
| FFI, menée par ENDO.**                                                                  | 円堂守がキャプテンを務める                                             |
| サッカー世界大会ＦＦＩの日本代表。                                                      | Japan's national team for the FFI                                      |
| World Cup, captained by ENDO.                                                           | `0x9A4E41BE`                                                           |
| **Les Raimon Eleven du temps de TENMA,                                                  |
| qui se sont battus pour ramener le vrai foot.**                                         | 本当のサッカーを取り戻すために戦う                                     |
| 松風天馬たちの世代の雷門イレブン。                                                      | The Raimon Eleven of TENMA's era                                       |
| who fight to restore true football.                                                     | `0x0AF15C2F`                                                           |
| **Une équipe suprême née de la fusion entre                                             |
| Lumière éternelle et Ombre ancestrale.**                                                | アンリミテッドシャイニングと                                           |
| エンシャントダークが融合した究極のチーム。                                              | A supreme team formed by uniting                                       |
| Eternal Light and Ancient Darkness.                                                     | `0x7DF66CB9`                                                           |
| **Agents du futur El Dorado,                                                            |
| envoyés pour effacer le foot de l'histoire.**                                           | 歴史からサッカーを消すために未来から来た                               |
| 意思決定機関エルドラドのエージェント。                                                  | Agents from the future's El Dorado,                                    |
| sent to erase football from history.                                                    | `0x1D31E55C`                                                           |
| **Les Eleven Ultimes, unis à travers le temps et l'espace                               |
| pour défendre le foot.**                                                                | サッカーを守るため　時を越えて集結した                                 |
| 覇者の聖典に記されし　時空最強のイレブン。                                              | The ultimate eleven, united across                                     |
| space and time to defend football.                                                      | `0x6A36D5CA`                                                           |
| **Une équipe de futurs hors-la-loi assemblée                                            |
| par la menace de rang S, ZANARK.**                                                      | Ｓ級危険人物であるザナークが集めた                                     |
| 未来世界の無法者たちのチーム。                                                          | A team of future outlaws assembled                                     |
| by the S-class threat ZANARK.                                                           | `0xF33F8470`                                                           |
| **Équipe terrienne dans le tournoi                                                      |
| inter-planétaire Grand Tournoi Galaxy.**                                                | 銀河の運命をかけた惑星間サッカー大会                                   |
| グランドセレスタ・ギャラクシーの地球代表。                                              | Earth's team in the interplanetary                                     |
| Grand Celesta Galaxy tournament.                                                        | `0x8438B4E6`                                                           |
| **Équipe ascendante de UNMEI, reconnue                                                  |
| pour ses tactiques et victoires rapides.**                                              | 発足から短期間で　勝利を重ねてきたチーム。                             |
| 笹波雲明の采配が光る　期待の新鋭。                                                      | A fast-rising squad led by UNMEI,                                      |
| defined by sharp tactics and rapid wins.                                                | `0x1A5C2145`                                                           |
| **Le Raimon Eleven où jouent ASUTO                                                      |
| et les joueurs de l'Île de Lointe.**                                                    | 稲森明日人たち　伊那国中サッカー部の                                   |
| メンバーで編成された雷門イレブン。                                                      | Raimon Eleven, made up of ASUTO                                        |
| and the Backwater Island players.                                                       | `0x6D5B11D3`                                                           |
| **Le Japon s'attaque au reste du monde                                                  |
| avec des joueurs comme ASUTO et ENDO.**                                                 | 策略が渦巻く世界大会に挑む日本代表。                                   |
| 稲森明日人や円堂守ら各校の精鋭選手が集結。                                              | Japan takes on the world stage with                                    |
| players like ASUTO and ENDO.                                                            | `0xF4524069`                                                           |
| **Représentants de la planète la plus avancée                                           |
| et militarisée de la galaxie.**                                                         | 銀河でも最高の英知と軍事力を持つ星                                     |
| ファラム・オービアスの代表イレブン。                                                    | Representatives of the galaxy's most                                   |
| advanced and militarily dominant planet.                                                | `0x835570FF`                                                           |
| **Une équipe de niveau national menée par                                               |
| HAIZAKI, le fameux Diable du terrain.**                                                 | フィールドの悪魔と呼ばれる灰崎を軸とした                               |
| 全国ランキング１位の強豪チーム。                                                        | A top-ranked national team led by HAIZAKI,                             |
| the feared Devil of the Pitch.                                                          | `0x13EA6D6E`                                                           |
| **Une équipe forgée par le programme Arès,                                              |
| créée pour forger des humains évolués.**                                                | 進化した人間を生み出す教育プログラム                                   |
| 『アレスの天秤』によって育成されたチーム。                                              | A team forged by the Ares program,                                     |
| created to produce evolved humans.                                                      | `0x64ED5DF8`                                                           |
| **Champions invaincus, les rois incontestés.                                            |
| Menés par leur star montante, HARU.**                                                   | 毎年　大会を制し続ける　無敗の王者。                                   |
| 期待の新星・円堂ハルのプレイが光る。                                                    | Back-to-back champions, the undefeated                                 |
| kings are led by rising star HARU.                                                      | `0x361CB69F`                                                           |
| **Grande équipe du Kyushu remplie                                                       |
| de tacticiens. Menée par SORAMIYA.**                                                    | 全員が優れた戦術眼を持つ　九州の強豪校。                               |
| 空宮征を中心に　様々な戦法を駆使する。                                                  | A Kyushu powerhouse where all players                                  |
| excel tactically, led by SORAMIYA.                                                      | `0x411B8609`                                                           |
| **体験版(操作側)**                                                                      | 体験版(操作側)                                                         | 体験版(操作側)                                    | `0xDF973506` |

---

## 5. Données Crawlées du Réseau Social X / Twitter (@Azalee_IE & Officiel)

L'analyse des 53 publications officielles archivées dans `/home/ubuntu/niers/data/glossary/azalee-tweets.json` met en lumière les temps forts de l'écosystème :

### 5.1. Annonce Majeure : Déploiement de la Version 5.0.0 & DLC Rising Bond

> _« La mise à jour 5.0.0 d'Inazuma Eleven Victory Road ajoutant le DLC Rising Bond est désormais disponible sur toutes les plateformes (Nintendo Switch, PS5, Steam, Xbox) ! Retrouvez le résumé complet des nouveautés et ajustements ci-dessous. »_ (2026-03-31)

- **Apports Clés de la Ver. 5.0.0 :**
  - Déblocage de **plus de 4 500 joueurs** dans le Mode Chronicle.
  - Intégration du système de constellations de recrutement et fragments d'esprits héroïques.
  - Rééquilibrage compétitif eSport et ajustement des coûts de Tension.

### 5.2. Extraits Chronologiques de la Veille Sociale Azalée

| Date (UTC) | Auteur       | Type   | Contenu de la Publication                                                                                      | Métriques |
| ---------- | ------------ | ------ | -------------------------------------------------------------------------------------------------------------- | --------- |
| 2026-03-31 | `@Azalee_IE` | Thread | La mise a jour 5.0.0 d'Inazuma Eleven Victory Road ajoutant le DLC Rising Bond est desormais disponible sur... | ️ 2,930  |  842 |
| 2026-03-31 | `@Azalee_IE` | Post   | [DLC Rising Bond] Plus de 4 500 joueurs du mode Chronicle sont desormais deblocables avec leurs constellati... | ️ 1,850  |  412 |
| 2026-04-15 | `@Azalee_IE` | Thread | [Tournoi Mondial Inazuma] LEVEL-5 annonce les dates officielles des qualifications regionales Europe & Fran... | ️ 2,100  |  620 |
| 2026-05-02 | `@Azalee_IE` | Post   | Equilibrage : Les techniques divines d'Aphrodi (God Knows & Heaven's Time) beneficient d'une revision de co... | ️ 1,940  |  530 |
| 2026-05-20 | `@Azalee_IE` | Post   | Stats Azalee : Le bot Discord Azalee franchit le cap des 150 000 requetes de fiches joueurs et glossaire de... | ️ 1,420  |  290 |
| 2026-06-07 | `@Azalee_IE` | Post   | [Patch Note IEVR] Mise a jour de maintenance v1.6.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 490    |  150 |
| 2026-06-08 | `@Azalee_IE` | Post   | [Patch Note IEVR] Mise a jour de maintenance v1.7.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 505    |  155 |
| 2026-06-09 | `@Azalee_IE` | Post   | [Patch Note IEVR] Mise a jour de maintenance v1.8.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 520    |  160 |
| 2026-06-10 | `@Azalee_IE` | Post   | [Patch Note IEVR] Mise a jour de maintenance v1.9.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 535    |  165 |
| 2026-06-11 | `@Azalee_IE` | Thread | [Patch Note IEVR] Mise a jour de maintenance v2.0.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 550    |  170 |
| 2026-06-12 | `@Azalee_IE` | Post   | [Patch Note IEVR] Mise a jour de maintenance v2.1.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 565    |  175 |
| 2026-06-13 | `@Azalee_IE` | Post   | [Patch Note IEVR] Mise a jour de maintenance v2.2.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 580    |  180 |
| 2026-06-14 | `@Azalee_IE` | Post   | [Patch Note IEVR] Mise a jour de maintenance v2.3.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 595    |  185 |
| 2026-06-15 | `@Azalee_IE` | Post   | [Patch Note IEVR] Mise a jour de maintenance v2.4.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 610    |  190 |
| 2026-06-16 | `@Azalee_IE` | Thread | [Patch Note IEVR] Mise a jour de maintenance v2.5.0 - Stabilite du Rollback Netcode et synchronisation VFS ... | ️ 625    |  195 |

---

## 6. Modèles de Synchronisation Planifiée (`nie-cron` & `rg-cron`) et Ponts Réseau

### 6.1. Architecture des Services Systemd Déployés

Deux démons de tâches planifiées hautement sécurisés opèrent en production sous le runtime Bun :

1. **`nie-cron.service` :**
   - **Dossier de Travail :** `/home/ubuntu/niers/packages/cron`
   - **Commande d'Exécution :** `/home/ubuntu/.bun/bin/bun --bun src/index.ts`
   - **Fichier d'Environnement :** `/home/ubuntu/.config/niers/cron.env`
   - **Ressources & Sécurité :** `ProtectSystem=strict`, `ProtectHome=read-only`, `MemoryMax=1G`, `LimitNOFILE=131072`.
   - **Périmètre R/W autorisé :** `/home/ubuntu/niers`, `/home/ubuntu/rg`, `/tmp`, `/home/ubuntu/.bxc`, `/var/www/cdn/static/website/public`, `/var/lib/rg`.

2. **`rg-cron.service` :**
   - **Dossier de Travail :** `/home/ubuntu/rg/packages/cron`
   - **Commande d'Exécution :** `/home/ubuntu/.bun/bin/bun run src/index.ts`
   - **Fichier d'Environnement :** `/home/ubuntu/rg/.env.local`
   - **Rôle :** Orchestration historique de la communauté Rose Griffon, bot Azalée, soumission IndexNow et préchauffage de cache.

### 6.2. Catalogue Partagé des Tâches (`@rosegriffon/types/cron`)

Le catalogue unique répertorie **23 tâches standardisées** réparties en 7 familles :

| Nom Canonique         | Planification Cron | Famille       | Rôle & Fonction                                                | Niveau d'Accès |
| --------------------- | ------------------ | ------------- | -------------------------------------------------------------- | -------------- |
| `cdn`                 | `0 */2 * * *`      | `donnees`     | Synchronise les assets statiques vers `/var/www/cdn/static/`   | `admin-strict` |
| `crawl`               | `0 4 * * *`        | `donnees`     | Crawl officiel Level-5 / Zukan via le moteur furtif bxc        | `admin-strict` |
| `db`                  | `30 3 * * *`       | `donnees`     | Rebuild du miroir SQLite Inagle et push des schémas            | `admin-strict` |
| `rag`                 | `0 5 * * *`        | `donnees`     | Synchronisation des embeddings RAG et vectorisation            | `admin-strict` |
| `x:campagnes`         | `20 * * * *`       | `campagnes`   | Récolte horaire des publications X de campagnes communautaires | `admin-strict` |
| `campagnes:discord`   | `25 * * * *`       | `campagnes`   | Récolte des créations postées dans les salons dédiés Discord   | `admin`        |
| `campagnes:instagram` | `35 * * * *`       | `campagnes`   | Revalidation des créations Instagram indexées                  | `admin`        |
| `campagnes:relais`    | `*/15 * * * *`     | `campagnes`   | Relais et mise en avant des créations validées sur les canaux  | `admin`        |
| `discord`             | `0 */3 * * *`      | `discord`     | Synchronisation complète de l'état des membres du Discord      | `admin`        |
| `discord:scan`        | `0 */6 * * *`      | `discord`     | Scan structurel des salons et catégories                       | `admin`        |
| `discord:messages`    | `*/10 * * * *`     | `discord`     | Synchronisation incrémentale des messages récents              | `admin`        |
| `discord:polls`       | `10 * * * *`       | `discord`     | Import des sondages et dépouillements                          | `admin`        |
| `seo:indexnow`        | `0 6 * * *`        | `seo`         | Soumission des nouveaux sitemaps aux moteurs (Bing, Yandex)    | `admin-strict` |
| `seo:llms-txt`        | `45 5 * * *`       | `seo`         | Régénération des fichiers `llms.txt` et `llm.txt`              | `admin`        |
| `stats:achillea`      | `*/15 * * * *`     | `stats`       | Rapatriement de l'audience et des métriques du second VPS      | `admin`        |
| `patreon`             | `0 12 * * *`       | `patreon`     | Rafraîchissement des paliers et abonnements contributeurs      | `admin`        |
| `warm`                | `0 7 * * *`        | `publication` | Préchauffage des caches d'application et fiches joueurs        | `admin`        |

### 6.3. Les Ponts de Données Temps Réel (Live Data Bridges)

1. **Pont HTTP / REST API (Port `:3005`) :**
   - `GET /health` : Vérification d'état de santé, uptime, occupation mémoire RSS et statut WebSocket.
   - `GET /tasks` : Liste intégrale des tâches déclarées et de leurs horaires cron.
   - `POST /tasks/:task/run` : Déclenchement manuel sécurisé avec contrôle de permission RBAC.
2. **Pont WebSocket Temps Réel (Log Streaming) :**
   - Interception globale des sorties `console.log`, `console.warn` et `console.error`.
   - Diffusion en streaming JSON `{ type: 'log', level, text, timestamp }` vers toutes les consoles d'administration.
3. **Pont IPC Bot Discord (`cron.sock`) :**
   - Communication ultra-rapide via socket Unix `/var/lib/rg/cron.sock`.
   - Permet au bot Azalée de notifier instantanément les alertes d'incident ou de relayer les commandes `/cron lancer`.
4. **Pont de Veille Sociale X (bxc + `@aphrody-code/x`) :**
   - Utilisation des sessions persistantes et cookies sécurisés (`~/.bxc/cookies/xcom.json`) évitant les surcoûts d'API.
   - Ingestion automatique des publications officielles, extraction des médias et transcription dans les fiches lore.

---

## 7. Vérification d'Intégrité & Localisation des Fichiers

| Emplacement du Fichier                                                    | Nature & Contenu                                                               | Statut Vérifié      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------- |
| `/home/ubuntu/niers/data/glossary/inazuma-glossary.json`                  | Base de données JSON consolidée (19 725 charas, 2 705 techniques, 371 équipes) | **ACTIF (1.06 Mo)** |
| `/home/ubuntu/niers/data/glossary/inazuma-glossary.md`                    | Glossaire condensé Markdown pour prompts et documentation                      | **ACTIF (78.4 Ko)** |
| `/home/ubuntu/niers/data/glossary/azalee-tweets.json`                     | Flux officiel de 53 tweets et annonces DLC 5.0.0                               | **ACTIF (25.5 Ko)** |
| `/home/ubuntu/niers/data/azalee/game-text-names.ndjson.gz`                | Matrice source de 193 641 lignes multilingues FR/JA/EN                         | **ACTIF (3.47 Mo)** |
| `/home/ubuntu/niers/data/azalee/skills-cutin.json`                        | Cut-ins et télops des Super Techniques                                         | **ACTIF (1.88 Mo)** |
| `/home/ubuntu/niers/data/azalee/passives-full.json`                       | Talents passifs et multiplicateurs de build                                    | **ACTIF (2.16 Mo)** |
| `/home/ubuntu/.aphrody/workspace/memory/crawled_inazuma_glossary_lore.md` | Document de synthèse souverain (Lore, Glossaire & Modèles Cron)                | **ACTIF & LISIBLE** |

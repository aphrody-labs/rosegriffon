# aphrody-nie-identity-source

Native parsers that construct Aphrody's game-data dossier from character, skill, and aura files. The external product pet assets and exporter are kept outside this crate; this package contains only game-derived source data and the local 3D identity contract.

The `host` feature enables the serde/std data parser integration.
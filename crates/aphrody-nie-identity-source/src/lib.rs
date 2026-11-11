//! Aphrody lu dans le jeu : la part de l'ancienne crate `nie-aphrody` qui dépend des fichiers
//! Level-5.
//!
//! Cette crate ne porte que les données et contrats dérivés des fichiers de jeu ; le pet 2D et les
//! éléments de marque restent dans le projet d'identité produit.
//!
//! - [`gisement`] : le dossier natif construit depuis `chara_param`, `skill_config` et
//!   `aura_skill_config` (parseurs de `aphrody-nie-data`) ;
//! - [`modele3d`] : le contrat 3D (pièces, chemins VFS, pont vers les pistes 2D du pet) ;
//! L'exporteur de paquet produit reste dans son dépôt propriétaire afin de ne pas embarquer ses
//! ressources d'application dans cette bibliothèque de données.

pub mod gisement;
/// Le contrat **3D** d'Aphrody : pièces, chemins VFS, ailes de « God Knows », pont vers les
/// pistes 2D. Ne parse ni n'assemble rien — `aphrody_nie_formats` en reste propriétaire.
pub mod modele3d;

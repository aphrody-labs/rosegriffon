# Orchestration infrastructure RG/Niers

La stack est décrite par [infra/stack.json](../../infra/stack.json), versionnée
indépendamment du code applicatif (`stackVersion`). Le manifest ne contient aucun
secret et ne remplace pas les sources de vérité des deux dépôts : `rg` reste
propriétaire de ses services, `niers` de ses services de données/modèle, et
Nginx reste la gateway publique.

## Commandes

```bash
bun scripts/ops/stack.ts check          # contrat statique, aucune mutation
bun scripts/ops/stack.ts status         # units + probes + disque
bun scripts/ops/stack.ts status --json --strict
bun scripts/ops/stack.ts plan           # check + état live, aucune mutation
bun scripts/ops/infra.ts check          # drift fichier dépôt ↔ machine
```

Le moniteur systemd est un timer read-only :

```bash
sudo systemctl enable --now rg-infra-monitor.timer
journalctl -u rg-infra-monitor.service -f
```

Il exécute une sonde toutes les 60 secondes. Un échec rend l’unité de monitoring
rouge et est visible dans journald, mais aucune unité applicative n’est relancée
automatiquement par ce chemin. Les mutations restent dans `deploy.ts`,
`release-stack.ts` et `infra.ts pull`, chacune explicitement appelée.

Le manifest signale aussi l’espace disque : avertissement à 85 %, échec critique à
95 %. L’état courant du VPS présente `/tmp` à environ 93 % : c’est un warning
opérationnel à traiter avant un prochain build lourd, pas une raison pour supprimer
automatiquement des artefacts potentiellement utiles.

## Règles de déduplication

- un composant possède un `id` unique et un propriétaire explicite ;
- un port ne peut pas être partagé par deux composants actifs ;
- les slots standby et services retired sont déclarés mais exclus du contrôle de
  collision et ne doivent pas être démarrés ;
- `infra.ts` compare les fichiers effectifs systemd/Nginx/sysctl/logrotate avec
  leurs sources versionnées ;
- les sauvegardes Nginx `.bak*` ne sont pas chargées et ne sont pas considérées
  comme des vhosts actifs.

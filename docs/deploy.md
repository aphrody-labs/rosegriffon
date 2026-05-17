# Deploy guide — Rose Griffon monorepo

Procédure complète pour passer le monorepo `rose-griffon/rg` en prod. **À exécuter manuellement** par l'admin, dans l'ordre. Chaque étape est isolée et réversible.

État pré-deploy attendu (après initial migration, validé 2026-05-17) :
- `https://github.com/rose-griffon/rg` privé, branch `main` à jour
- 8 commits initial migration, `turbo run type-check` + `turbo run lint` verts (6/6)
- Vercel projects `rg-azalee` + `rg-website` **créés** dans le scope `aphrody`, env vars `production` poussés, framework `nextjs`, rootDirectory configuré
- Service systemd `rg-bot.service` **installé** dans `/etc/systemd/system/` (daemon-reload fait), **PAS encore démarré**
- Anciens projets Vercel `azalee` / `rosegriffon` toujours en prod sur leurs domaines custom
- VPS submodules `apps/azalee` / `apps/rosegriffon` toujours en place (figés, pointers Git intacts)

---

## Étape 1 — Valider les nouveaux projets Vercel (preview deploy)

Les projets Vercel `rg-azalee` et `rg-website` ont été créés et configurés via API, mais **aucun deploy n'a été déclenché** pour ne pas risquer de casser quoi que ce soit. Avant de basculer la prod, il faut valider que le build passe.

```bash
# Depuis ~/rg/ (workspace racine — important pour la résolution workspace deps)
cd ~/rg

# Trigger preview deploy azalee
vercel --yes --cwd apps/azalee
# Attendu : URL preview rg-azalee-xxx.vercel.app, build vert (~5-10 min sur 1ère build cold)

# Trigger preview deploy website
vercel --yes --cwd apps/website
# Attendu : URL preview rg-website-xxx.vercel.app, build vert
```

**Si le deploy échoue avec "path does not exist"** : le link Vercel a été fait depuis le sous-dossier `apps/azalee/` au lieu de la racine, ce qui fait que le rootDirectory `apps/azalee` est résolu à `apps/azalee/apps/azalee`. Fix :

```bash
# Unlink puis re-link depuis la racine du monorepo (~/rg/)
rm -rf ~/rg/apps/azalee/.vercel ~/rg/apps/website/.vercel
cd ~/rg
vercel link --project rg-azalee --scope aphrody --yes
# Quand demandé pour le path : taper `apps/azalee` (mais ce n'est plus interactif avec --yes,
# faut peut-être passer par le dashboard Vercel pour set le rootDirectory à `apps/azalee`)
```

Alternative dashboard : https://vercel.com/aphrody/rg-azalee/settings → Root Directory → `apps/azalee` → Save.

**Vérifier le preview deploy** :
- Pages clés azalee : `/`, `/wiki`, `/wiki/zukan`, `/dashboard` (auth requise — utiliser un compte test)
- Pages clés website : `/`, `/articles`, `/equipe`, `/rose-griffon-tv`, `/dashboard`
- Pas d'erreur 500, console browser propre (warnings tolérés)

---

## Étape 2 — Bascule du domaine custom (vraie prod)

Une fois les preview validés, transférer les domaines custom des anciens projets vers les nouveaux. **C'est l'étape critique — DNS ne sera pas affecté (déjà sur Vercel `76.76.21.21`), mais le projet qui sert le trafic change.**

### Pour `azalee.rosegriffon.fr` :

```bash
# 1. Retirer le domaine du projet azalee (ancien)
vercel domains rm azalee.rosegriffon.fr --scope aphrody

# 2. L'ajouter au projet rg-azalee (nouveau)
cd ~/rg/apps/azalee
vercel domains add azalee.rosegriffon.fr --scope aphrody
```

Vercel détecte automatiquement que le DNS pointe déjà vers son infra (apex A `76.76.21.21`) — aucune modif DNS Cloudflare requise.

### Pour `rosegriffon.fr` (apex + www) :

```bash
vercel domains rm rosegriffon.fr --scope aphrody
vercel domains rm www.rosegriffon.fr --scope aphrody

cd ~/rg/apps/website
vercel domains add rosegriffon.fr --scope aphrody
vercel domains add www.rosegriffon.fr --scope aphrody
```

### Promouvoir le preview en production :

```bash
# Depuis ~/rg/, deploy --prod sur chacun
vercel --prod --yes --cwd apps/azalee
vercel --prod --yes --cwd apps/website
```

### Test de fumée prod :

```bash
curl -sIL https://azalee.rosegriffon.fr | head -3      # 200 OK attendu
curl -sIL https://rosegriffon.fr | head -3             # 200 OK attendu
```

Si KO : remettre les domains sur les anciens projets (rollback immédiat).

---

## Étape 3 — Retirer les submodules vps (cleanup)

**Une fois la prod stable sur les nouveaux projets (24-48h recommandé)**, retirer les submodules `apps/azalee` et `apps/rosegriffon` du repo `aphrody-code/vps`.

```bash
cd ~/vps

# 1. Désinstaller les submodules (libère .git/modules/)
git submodule deinit -f apps/azalee
git submodule deinit -f apps/rosegriffon

# 2. Retirer du tracking git (supprime aussi les dossiers)
git rm -f apps/azalee
git rm -f apps/rosegriffon

# 3. Nettoyer .git/modules (orphelins)
rm -rf .git/modules/apps/azalee .git/modules/apps/rosegriffon

# 4. Mettre à jour .gitmodules (retirer les 2 entrées)
# (manuel : éditer .gitmodules, retirer les sections [submodule "apps/azalee"] et [submodule "apps/rosegriffon"])

# 5. Commit
git add .gitmodules apps/azalee apps/rosegriffon
git commit -m "chore: retirer submodules apps/azalee + apps/rosegriffon (migrés vers rose-griffon/rg)"
git push origin main
```

**Vérifier** : `bash scripts/ops/check-status.sh` (apps/azalee + apps/rosegriffon ne doivent plus apparaître dans le scan mrx).

---

## Étape 4 — Activer rg-bot

Le service systemd est **déjà installé** à `/etc/systemd/system/rg-bot.service`, daemon-reload fait. Le fichier `.env` est créé à `/home/ubuntu/rg/apps/bot/.env` avec 4 vars Supabase pré-remplies depuis le projet website.

**Manquent** (à fournir avant start) :
- `DISCORD_BOT_TOKEN` — créer une application Discord https://discord.com/developers/applications → New Application "Rose Griffon Bot" → Bot tab → Reset Token → copier
- `DISCORD_CLIENT_ID` — Application ID (visible sur General Information)
- `WEBSITE_API_URL` — `https://rosegriffon.fr/api/bot` (URL du website pour les services `website.ts`)
- `WEBSITE_URL` — `https://rosegriffon.fr`
- `BOT_API_TOKEN` — secret partagé entre le bot et le website pour authentifier les calls `/api/bot/*` (générer via `openssl rand -hex 32`)

### Compléter le .env (sans leak dans la conv shell) :

```bash
# Édit interactif — ne pas cat le file après !
nano /home/ubuntu/rg/apps/bot/.env

# Ajouter les 5 vars manquantes :
# DISCORD_BOT_TOKEN=...
# DISCORD_CLIENT_ID=...
# WEBSITE_API_URL=https://rosegriffon.fr/api/bot
# WEBSITE_URL=https://rosegriffon.fr
# BOT_API_TOKEN=...
```

### Inviter le bot dans le serveur Discord Rose Griffon :

```
https://discord.com/api/oauth2/authorize?client_id=<DISCORD_CLIENT_ID>&permissions=8&scope=bot+applications.commands
```

(permissions=8 = administrateur, ajuster selon besoin réel)

### Démarrer + monitor :

```bash
sudo systemctl start rg-bot.service
sudo systemctl status rg-bot.service       # Doit afficher "active (running)"
journalctl -u rg-bot.service -f -n 50      # Suivre les logs
```

### Auto-restart au boot (recommandé) :

```bash
sudo systemctl enable rg-bot.service
```

### Smoke test :

Dans Discord, taper `/sync` (commande admin) → doit répondre "Sync terminé : N members synchronisés".

---

## Rollback

### Vercel
- Bascule domain ratée → `vercel domains rm` puis re-ajouter sur l'ancien projet (`azalee` / `rosegriffon`)
- Build cassé → `vercel rollback https://<ancien-deploy>.vercel.app --scope aphrody`

### VPS submodules
- `git revert <sha>` puis `git submodule update --init apps/azalee apps/rosegriffon`

### Bot
- `sudo systemctl stop rg-bot.service` + `sudo systemctl disable rg-bot.service`
- Le bot ne touche aucune table critique en lecture seule pour les services initiaux

---

## Checklist finale (à cocher dans l'ordre)

- [ ] Preview deploy azalee (rg-azalee) : URL accessible, build vert, smoke test OK
- [ ] Preview deploy website (rg-website) : idem
- [ ] Bascule domain `azalee.rosegriffon.fr` → rg-azalee
- [ ] Bascule domain `rosegriffon.fr` + `www.rosegriffon.fr` → rg-website
- [ ] Promote preview → prod (deploy --prod)
- [ ] 24-48h de monitoring : pas d'erreur 500, Vercel analytics OK
- [ ] Retrait submodules vps (commit + push)
- [ ] DISCORD_BOT_TOKEN + DISCORD_CLIENT_ID + BOT_API_TOKEN fournis dans `.env` bot
- [ ] `systemctl start rg-bot.service` + smoke test Discord
- [ ] `systemctl enable rg-bot.service` (auto-restart au boot)

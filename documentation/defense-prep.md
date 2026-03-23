# TabHub — Préparation à la soutenance

> Ce document est un guide de préparation pratique : pitchs calibrés, questions anticipées avec réponses modèles, checklist de démo live, et points faibles à adresser proactivement.

---

## Pitch rapide

### 30 secondes (accueil du jury)

> « TabHub est un système de gestion de restaurant en temps réel, multi-tenant, accessible depuis n'importe quel téléphone sans installation. Un client scanne le QR code sur sa table, commande directement, la cuisine reçoit le ticket en moins de 100 ms et le manager voit tout depuis son tableau de bord. Le tout est déployé en production sur Azure, couvert par 83 tests E2E automatisés, et supporte trois langues dont l'arabe avec RTL natif. »

### 3 minutes (présentation principale)

1. **Le problème** — 12 000 restaurants en Tunisie, moins de 3 % utilisent un logiciel de gestion. Les solutions existantes coûtent 50–200 €/mois, sont en anglais uniquement, sans support arabe. Le marché est ouvert.
2. **La solution** — TabHub : SaaS multi-tenant, 7 surfaces applicatives (client QR, serveur, cuisine, caisse, affichage takeaway, dashboard manager, super admin), temps réel via SignalR.
3. **L'architecture** — PostgreSQL schéma-par-tenant (isolation complète), ASP.NET Core 8, React 19, SignalR WebSocket. Déployé sur Azure (App Service B1 + Static Web App + PostgreSQL Flexible Server), CI/CD GitHub Actions.
4. **Les preuves** — 83 tests E2E Playwright contre la production, tests backend xUnit + Testcontainers, trilingual FR/AR/EN. En production depuis le Sprint 9.

---

## Questions anticipées du jury

### Architecture & base de données

**Q : Pourquoi schéma-par-tenant et non une colonne `tenant_id` sur chaque table ?**

> Trois raisons. Premièrement, l'isolation est garantie au niveau du moteur de base de données via `search_path` — il est impossible d'oublier de filtrer par tenant dans une requête, contrairement à row-per-tenant où un oubli de clause WHERE expose les données d'un autre restaurant. Deuxièmement, les requêtes sont plus simples et plus rapides (pas de jointure ou de filtre systématique). Troisièmement, la sauvegarde par tenant est triviale : `pg_dump -n cafetunisia`. Le seul inconvénient est la limite PostgreSQL à ~500 schémas, ce qui est largement suffisant pour la phase de croissance visée.

**Q : Comment garantis-tu qu'un tenant ne peut pas accéder aux données d'un autre ?**

> Le `TenantMiddleware` lit l'en-tête `X-Tenant` sur chaque requête, vérifie que le tenant existe dans la table `public.tenants`, puis exécute `SET search_path TO {schema}`. Toute requête EF Core cible automatiquement le bon schéma. Il n'existe aucune table partagée dans les schémas tenant — impossible de référencer une entité d'un autre schéma par construction. J'ai un test dédié `TenantIsolation` qui vérifie qu'un JWT d'un tenant est rejeté sur les endpoints d'un autre.

**Q : Pourquoi PostgreSQL et non une base NoSQL comme MongoDB ?**

> Le domaine restaurant est intrinsèquement relationnel : une commande appartient à une session, qui appartient à une table, dans un espace. Les contraintes de clé étrangère et les transactions ACID sont essentielles — on ne peut pas avoir une commande liée à une table supprimée. PostgreSQL offre aussi JSONB pour les logs d'audit et les UUIDs natifs. Une base NoSQL aurait complexifié les requêtes de reporting (chiffre d'affaires par jour, top items) sans apporter de bénéfice réel à cette échelle.

---

### Temps réel & SignalR

**Q : Pourquoi SignalR et non du polling ou des Server-Sent Events ?**

> Le polling toutes les 5 secondes crée une latence inacceptable pour la cuisine (le chef voit la commande 5 secondes après que le client a validé) et génère des requêtes constantes même quand rien ne se passe. Les Server-Sent Events sont unidirectionnels — je ne peux pas envoyer d'événements depuis le client vers le serveur sur le même canal. SignalR WebSocket donne < 100 ms de latence, zéro requête au repos, et un seul canal pour tous les types d'événements. ASP.NET Core intègre SignalR nativement, sans dépendance externe.

**Q : Que se passe-t-il si la connexion SignalR est coupée ?**

> Deux mécanismes. Côté client, `withAutomaticReconnect()` tente de se reconnecter avec backoff exponentiel (2s, 10s, 30s, 30s). Côté serveur, `OnConnectedAsync` re-rejoint tous les groupes à chaque connexion, y compris après une reconnexion — le client ne manque donc aucun groupe. J'ai un indicateur visuel (point vert/rouge) dans la cuisine et une bannière dans l'app serveur pour signaler l'état de la connexion.

**Q : Comment gères-tu les notifications concurrentes (deux serveurs ACK la même commande en même temps) ?**

> Le pattern "competing consumer" avec `SELECT … FOR UPDATE` dans PostgreSQL. Quand deux serveurs tapent en même temps sur `PUT /notifications/{id}/ack`, la première requête pose un verrou de ligne. La seconde obtient un 409 Conflict avec un message "déjà pris en charge". Ce comportement est couvert par le test `OrderHubTests`.

---

### Sécurité & authentification

**Q : Pourquoi deux systèmes d'authentification différents (JWT + Argon2id pour les managers, PIN + BCrypt pour le personnel) ?**

> C'est un choix UX délibéré. Un manager se connecte une fois par session depuis son propre appareil — un mot de passe fort avec Argon2id (memory-hard, résistant aux attaques GPU) est approprié. Un serveur change de tablette partagée plusieurs fois par service — un PIN à 4 chiffres en BCrypt est le bon compromis entre sécurité et rapidité d'accès. Argon2id pour les PINs serait disproportionné et ralentirait la connexion du serveur.

**Q : Les JWTs de 15 minutes, comment le refresh fonctionne-t-il ?**

> À la connexion, l'API retourne un JWT (15 min, dans la réponse JSON) et un refresh token (30 jours, dans un cookie httpOnly). Le frontend React stocke le JWT en mémoire (localStorage pour simplifier la démo). Quand une requête retourne 401, l'intercepteur Axios appelle `POST /auth/refresh` automatiquement, récupère un nouveau JWT, et relance la requête originale. Le cookie httpOnly n'est pas accessible au JavaScript — protégé contre le XSS.

**Q : Comment protèges-tu contre les injections SQL ?**

> Entity Framework Core utilise des requêtes paramétrées par défaut — aucune interpolation de chaîne SQL. Les rares requêtes brutes (ex. `SET search_path TO {schema}`) utilisent uniquement le slug validé par regex `^[a-z0-9_]+$` via FluentValidation, ce qui rend toute injection impossible.

---

### Tests & qualité

**Q : 83 tests E2E, c'est beaucoup — comment assures-tu leur fiabilité ?**

> Trois principes. Premièrement, exécution séquentielle (`workers: 1`) — pas de race conditions entre tests. Deuxièmement, pattern find-or-create : chaque test cherche son entité par nom (préfixe `E2E`) avant de la créer — idempotent, sans échecs de contrainte unique après plusieurs exécutions. Troisièmement, teardown automatique post-run qui nettoie toutes les entités préfixées `E2E`. Les tests multi-contexte SignalR ouvrent 5 fenêtres de navigateur simultanées pour valider la propagation temps réel.

**Q : Pourquoi les tests E2E tournent contre la production et non un environnement de staging ?**

> Choix pragmatique pour un projet académique avec budget zéro. L'alternative correcte serait un environnement staging sur Azure (coût supplémentaire). Le préfixe `E2E` sur toutes les entités créées et le teardown post-run limitent l'impact sur les données de production. Pour une commercialisation, j'ajouterais un environnement staging dans le pipeline CI/CD.

---

### Scalabilité & déploiement

**Q : Azure B1, c'est suffisant ? Comment tu passes à l'échelle ?**

> Pour la démo et la phase pilote avec 5–10 restaurants, oui — B1 gère plusieurs centaines de connexions simultanées. Le premier goulot d'étranglement serait SignalR : ASP.NET Core SignalR en mémoire ne se répartit pas sur plusieurs instances. La migration vers Azure SignalR Service (scale-out managé) est dans la roadmap à priorité haute. Le schéma-per-tenant permet de partitionner les données par tenant si nécessaire. PostgreSQL Flexible Server passe à des tiers supérieurs sans changement de code.

**Q : Pourquoi Azure et non Render, Railway ou Fly.io ?**

> Azure offre 12 mois gratuits sur l'App Service B1 et le PostgreSQL Flexible Server — coût de démo = 0 €. De plus, l'infrastructure est décrite en Bicep dans le dépôt (`infra/`), ce qui est un livrable en soi : IaC documentée, déployable en un clic. Ce n'est pas juste "ça marche en prod", c'est une infrastructure reproductible.

---

### Produit & marché

**Q : Quel est le modèle économique ?**

> Trois plans SaaS : Starter (49 TND/mois, 1 espace, 20 tables, 3 employés), Pro (99 TND/mois, illimité), Enterprise (sur devis, multi-site). C'est 5 à 10 fois moins cher que les solutions occidentales (Lightspeed, Zelty). Avantages compétitifs : prix, arabe natif RTL, onboarding en 5 minutes, support local, TVA tunisienne intégrée.

**Q : Que ferais-tu différemment si tu recommençais ?**

> Deux choses. D'abord, mettre en place un environnement de staging dès le Sprint 9 pour les tests E2E — cela aurait rendu les tests plus isolés. Ensuite, utiliser Azure SignalR Service dès le départ plutôt que SignalR en mémoire — la migration ultérieure est possible mais représente un refactoring. Tout le reste — schéma-per-tenant, multi-surface SPA, deux niveaux d'auth — je referais exactement de la même façon.

---

## Checklist démo live

Ouvrir ces onglets **avant** de commencer la démo :

| # | Onglet | URL | Auth |
|---|--------|-----|------|
| 1 | Manager dashboard | `/manager/cafetunisia/dashboard` | `mehdi@cafetunisia.com / mehdi123` |
| 2 | Customer QR menu | `/menu/cafetunisia?table=<qrToken>` | Aucune |
| 3 | Waiter app | `/waiter/cafetunisia` | PIN `1234` (Ahmed) |
| 4 | Kitchen | `/kitchen/cafetunisia` | PIN `2222` (Fatma) |
| 5 | Cashier | `/cashier/cafetunisia` | PIN `3333` (Omar) |
| 6 | Takeaway board | `/takeaway/cafetunisia` | Aucune |

> Récupérer le `<qrToken>` dans le dashboard → Espaces → QR sur une table.

### Séquence démo (5 minutes)

1. **Manager** — Montrer le dashboard (KPIs, graphique chiffre d'affaires, top items).
2. **Onglet Customer** — Ouvrir le menu QR, ajouter 2 items au panier dont un avec modificateur (café → choix du sucre). Valider la commande.
3. **Onglet Waiter** — La bannière de notification apparaît en temps réel. ACK. Montrer le plan de salle (tables colorées).
4. **Onglet Kitchen** — La carte apparaît en colonne Pending. Avancer → InProgress → Ready. Montrer le timer.
5. **Onglet Cashier** — Fermer la session. Générer le PDF. Montrer le PDF avec TVA et totaux.
6. **Manager** — Retour au dashboard. Montrer que les KPIs ont changé.
7. **Bonus : Takeaway** — Depuis Cashier, passer une commande takeaway. Le board affiche le numéro en live.

### Si la démo plante

- **SignalR déconnecté** : le point rouge s'affiche. Rafraîchir l'onglet — reconnexion automatique en < 5s.
- **Erreur 401** : le token a expiré. Aller sur `/login`, se reconnecter, revenir.
- **API lente** : Azure App Service B1 peut avoir un cold start de 10–15s après inactivité. Lancer une requête de "préchauffage" sur `/health` 2 minutes avant la démo.

---

## Chiffres clés à mémoriser

| Métrique | Valeur |
|----------|--------|
| Tests E2E automatisés | 83 (T-01 à T-83) |
| Latence SignalR | < 100 ms |
| Surfaces applicatives | 7 |
| Langues supportées | 3 (FR / AR RTL / EN) |
| Sprints | 10 × 1 semaine |
| Coût mensuel Azure | ~0 € (free tier 12 mois) |
| Restaurants actifs en Tunisie | ~12 000 (INS 2023) |
| Taux d'équipement actuel | < 3 % |
| Prix Starter | 49 TND/mois |
| Durée onboarding | < 5 minutes |

---

## Points faibles — les adresser proactivement

Ne pas attendre que le jury les soulève. Les mentionner soi-même montre la maturité.

| Point faible | Réponse proactive |
|--------------|-------------------|
| Tests E2E sur production | "J'aurais dû avoir un staging. En production, les entités E2E sont préfixées et nettoyées automatiquement en post-run." |
| Pas de tests unitaires frontend pour Spaces/Menu/Staff | "Le choix délibéré a été de prioriser les tests E2E qui couvrent ces surfaces de bout en bout (T-10 à T-24). Pour une version commerciale, j'ajouterais les tests unitaires." |
| Super admin upserted au démarrage | "C'est un raccourci de dev. En production réelle, ce serait derrière un flag d'environnement ou une commande CLI dédiée." |
| B1 + SignalR en mémoire ne scale pas horizontalement | "La migration vers Azure SignalR Service est dans la roadmap à priorité haute — c'est un changement de configuration, pas un refactoring majeur." |

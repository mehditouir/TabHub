# TabHub — Rapport de Fin d'Études
**Projet de fin d'études · 2024–2025**

---

## Table des matières

1. [Problématique](#1-problématique)
2. [Solution proposée — TabHub](#2-solution-proposée--tabhub)
3. [Architecture technique](#3-architecture-technique)
4. [Décisions techniques clés](#4-décisions-techniques-clés)
5. [Plan de développement — 10 sprints](#5-plan-de-développement--10-sprints)
6. [Surfaces applicatives](#6-surfaces-applicatives)
7. [Sécurité et robustesse](#7-sécurité-et-robustesse)
8. [Déploiement cloud](#8-déploiement-cloud)
9. [Tests automatisés](#9-tests-automatisés)
10. [Résultats et métriques](#10-résultats-et-métriques)
11. [Travaux futurs et commercialisation](#11-travaux-futurs-et-commercialisation)
12. [Conclusion](#12-conclusion)

---

## 1. Problématique

### La réalité des restaurants en Tunisie (et dans la région MENA)

La gestion d'un restaurant repose encore aujourd'hui sur des processus manuels qui génèrent des coûts cachés importants :

| Problème | Impact concret |
|----------|---------------|
| Commandes prises à la main | Erreurs fréquentes, mauvaise communication cuisine/salle |
| Attente du serveur | Frustration client, rotation des tables ralentie |
| Gestion du stock/menu sur papier | Menu imprimé obsolète dès qu'un plat manque |
| Aucune visibilité en temps réel | Le manager découvre les problèmes après coup |
| Facturation manuelle | Lenteur, erreurs de calcul, TVA approximative |
| Pas de données d'analyse | Aucun suivi des plats populaires, revenus, heures de pointe |

Les solutions existantes (Lightspeed, Square, Zelty) sont conçues pour des marchés occidentaux :
- Prix prohibitifs pour un restaurant tunisien moyen (50–200 €/mois)
- Interface en anglais uniquement
- Pas de support arabe (RTL)
- Architecture monolithique non adaptée au multi-établissement

### L'opportunité

Le marché tunisien compte environ **12 000 restaurants et cafés** actifs (INS 2023). Moins de 3 % utilisent un logiciel de gestion. La marge de progression est considérable.

---

## 2. Solution proposée — TabHub

TabHub est un **système de gestion de restaurant multi-tenant en temps réel**, accessible depuis n'importe quel appareil connecté, sans installation.

### Proposition de valeur

```
Client scanne le QR code sur la table
        ↓
Commande passée depuis le téléphone
        ↓
Notification instantanée au serveur
        ↓
Ticket envoyé à la cuisine en temps réel
        ↓
Caissier ferme la session, imprime la facture PDF
        ↓
Manager voit tout depuis le dashboard
```

**Ce que TabHub apporte :**
- **Zéro erreur de commande** — le client saisit lui-même, la cuisine reçoit exactement ce qui a été commandé
- **+20 % de rotation tables** — plus d'attente pour appeler le serveur
- **Menu live** — désactiver un plat épuisé en 2 secondes depuis le téléphone
- **Données réelles** — revenus, plats populaires, heures de pointe, durée moyenne de service
- **Multi-établissement** — un seul compte pour gérer plusieurs restaurants
- **Trilingue FR/AR/EN** — conçu pour le marché tunisien avec support RTL natif

---

## 3. Architecture technique

### Stack technologique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| API Backend | ASP.NET Core 8 (C#) | Performance, écosystème riche, excellent support WebSocket |
| Base de données | PostgreSQL 15 | ACID, schémas multiples, JSONB, UUIDs natifs |
| Temps réel | SignalR (ASP.NET Core) | WebSocket avec fallback automatique, intégré au backend |
| Frontend | React 19 + Vite + TypeScript | Composants réutilisables, build ultra-rapide |
| Styling | Tailwind CSS 3 | Utility-first, responsive, support RTL via logical properties |
| ORM | Entity Framework Core 8 | Migrations, requêtes LINQ typées, transactions |
| Auth | JWT (Bearer) + Argon2id / BCrypt | Tokens courts (15 min) + Argon2id pour les managers, BCrypt PIN pour le personnel |
| PDF | QuestPDF | Génération in-process, pas de dépendance externe |
| CI/CD | GitHub Actions | Build, test, déploiement automatique |
| Cloud | Azure (Free Tier B1) | App Service + Static Web App + PostgreSQL Flexible Server |

### Architecture multi-tenant : schéma-par-tenant

```
PostgreSQL
├── public
│   ├── tenants          ← registre des restaurants
│   ├── managers         ← comptes propriétaires
│   └── manager_tenants  ← association manager ↔ restaurant
├── cafetunisia          ← schéma isolé tenant 1
│   ├── spaces, tables
│   ├── staff, waiter_zones
│   ├── categories, menu_items, modifier_groups
│   ├── menus, menu_schedule_rules
│   ├── table_sessions, orders, order_items
│   └── notifications, audit_logs
└── restauranttunisia    ← schéma isolé tenant 2
    └── (idem)
```

**Avantages de ce choix :**
- Isolation totale des données (impossible de voir les données d'un autre restaurant)
- Pas de colonne `tenant_id` sur chaque table — requêtes plus simples
- Backup par tenant trivial (`pg_dump -n cafetunisia`)
- Migration SchemaProvisioner : nouvel restaurant → nouveau schéma automatiquement

### Flux de données en temps réel (SignalR)

```
[Client Browser]                [Backend SignalR Hub]
     │                                   │
     │──── WS connect (tenant group) ────▶│
     │                                   │
[Customer places order]                  │
     │──── POST /orders ─────────────────▶│
                                         │── broadcast → "tenant:cafetunisia"
                                         │     ├── Waiter app: notification badge
                                         │     ├── Kitchen app: new card in kanban
                                         │     └── Cashier app: session updated
```

---

## 4. Décisions techniques clés

### 4.1 Schéma-par-tenant plutôt que ligne-par-tenant

| Approche | Avantages | Inconvénients |
|----------|-----------|---------------|
| **Schéma-par-tenant** ✅ | Isolation totale, pas de filtre à oublier, backup simple | DDL à dupliquer, ~500 MB limite schema count |
| Ligne-par-tenant | Un seul schéma | Risque de fuite de données, requêtes plus complexes |
| DB-par-tenant | Isolation maximale | Coût opérationnel prohibitif |

Pour un SaaS B2B restaurant, le schéma-par-tenant est le bon compromis.

### 4.2 SignalR plutôt que polling

Le polling (toutes les X secondes) aurait été plus simple à implémenter mais génère :
- Latence de 2–10 secondes (mauvaise UX pour la cuisine)
- Charge serveur constante même sans activité
- Batterie mobile drainée

SignalR (WebSocket) donne :
- Mise à jour < 100 ms
- Zéro requête si rien ne change
- Un seul canal pour tous les événements (orders, status changes, notifications)

### 4.3 Authentification à deux niveaux

```
Manager (propriétaire)    → JWT Bearer + refresh cookie httpOnly  (mot de passe : Argon2id)
Staff (serveur/cuisine)   → PIN BCrypt (4-8 chiffres)
```

Les serveurs n'ont pas d'email/mot de passe. Ils utilisent un PIN simple sur une tablette partagée. Ce choix UX est crucial : un serveur ne doit pas perdre de temps à taper un mot de passe complexe entre chaque service.

### 4.4 React SPA multi-surface

Une seule application React sert 7 surfaces différentes :

```
/menu/:tenant        → interface client (téléphone)
/waiter/:tenant      → app serveur (tablette)
/kitchen/:tenant     → kanban cuisine (écran mural)
/cashier/:tenant     → caisse (tablette)
/takeaway/:tenant    → écran d'affichage emporter
/manager/:tenant/*   → dashboard propriétaire
/admin               → panneau super admin
```

**Avantage :** un seul build, un seul déploiement, code partagé (composants, API client, traductions).

---

## 5. Plan de développement — 10 sprints

| Sprint | Durée | Objectif | Livrable principal |
|--------|-------|----------|--------------------|
| 0 | 1 sem. | Architecture & fondations | API /health, Docker, CI |
| 1 | 1 sem. | Identité & configuration | Auth JWT, config restaurant, provisioning tenant |
| 2 | 1 sem. | Système de menu | Catégories, items, modificateurs, ingrédients |
| 3 | 1 sem. | Moteur de commandes | Sessions, ordres, facturation PDF |
| 4 | 1 sem. | Temps réel SignalR | Hub WebSocket, notifications live |
| 5 | 1 sem. | Dashboard manager | KPIs, graphiques revenus, top items |
| 6 | 1 sem. | Interface client QR | Menu customer, ajout panier, placement commande |
| 7 | 1 sem. | Application serveur | Waiter app, zones, ACK notifications |
| 8 | 1 sem. | Cuisine, caisse, emporter | Kanban kitchen, cashier kiosk, takeaway board |
| 9 | 1 sem. | Déploiement cloud | Azure, CI/CD GitHub Actions, HTTPS |
| 10 | 1 sem. | Durcissement & démo | Sécurité, RTL, tests E2E, données démo |

**Durée totale : ~10 semaines** de développement effectif.

---

## 6. Surfaces applicatives

### 6.1 Interface client (QR menu)
- Accessible via QR code sur chaque table (`/menu/:tenant?table=<uuid>`)
- Affiche le menu actif en temps réel (selon les règles de planification)
- Ajout au panier avec modificateurs (sucre, cuisson, extras)
- Placement de commande sans compte, sans installation
- Support FR / AR (RTL natif) / EN

### 6.2 Application serveur (Waiter app)
- Login PIN en 2 secondes sur tablette partagée
- Plan de salle interactif — tables colorées selon leur statut
- Badge de notification temps réel pour les nouvelles commandes
- ACK de commande, avancement des statuts
- Gestion des zones (serveur X couvre les tables Y à Z)

### 6.3 Kanban cuisine (Kitchen app)
- Vue Kanban : Pending → InProgress → Ready
- Minuteur par commande (identifie les retards)
- Indicateur de connexion SignalR (point vert/rouge)
- Filtrage par rôle cuisine (Chef Amine vs Sana ne voient que leur partie)

### 6.4 Caisse (Cashier app)
- Prise de commande emporter (avec numéro de séquence affiché)
- Fermeture de session de table
- Génération PDF de la facture (QuestPDF, TVA incluse)
- Historique des sessions de la journée

### 6.5 Tableau d'affichage emporter (Takeaway display)
- Écran grand format, pas d'auth requis
- Affiche les commandes emporter en cours et prêtes
- Mise à jour live via SignalR

### 6.6 Dashboard manager
- KPIs temps réel : total commandes, en attente, en cours, prêtes, complètes, annulées
- Graphique revenus sur 30 jours (barres par jour)
- Top 5 plats (quantité + chiffre d'affaires)
- Durée moyenne de complétion d'une commande

### 6.7 Panneau super admin
- Création et gestion des tenants (restaurants)
- Création et gestion des managers
- Attribution d'un manager à plusieurs restaurants

---

## 7. Sécurité et robustesse

### Mesures de sécurité implémentées

| Mesure | Détail |
|--------|--------|
| JWT courts (15 min) | Refresh via cookie httpOnly (30 jours) |
| Argon2id (managers) | Hachage mémoire-dur pour les mots de passe — gagnant du Password Hashing Competition |
| BCrypt work factor 10 (staff) | Hachage des PINs — approprié pour les codes courts |
| Rate limiting | 10 req/min par IP sur les endpoints auth |
| FluentValidation | Validation stricte des entrées (email format, PIN 4-8 chiffres, slug regex) |
| Tenant isolation | `search_path` par requête, impossible d'accéder aux données d'un autre tenant |
| Soft delete | `deleted_at` — aucune donnée supprimée physiquement |
| Audit log | Toutes les mutations sont loguées (actor, before/after state) |
| ExceptionMiddleware | JSON `{ "error": "..." }` uniforme sur toute exception non catchée |
| CORS configuré | Origins autorisées explicitement en production |

### Robustesse
- Testcontainers pour les tests d'intégration backend (vraie DB PostgreSQL)
- MSW (Mock Service Worker) pour les tests frontend
- 83 tests E2E Playwright automatisés contre la production
- CI/CD GitHub Actions : build + test + deploy à chaque push sur master

---

## 8. Déploiement cloud

### Architecture Azure (Free Tier 12 mois)

```
Internet
   │
   ├── Azure Static Web App (Free)
   │   └── React SPA (frontend/)
   │
   ├── Azure App Service B1 (Free 12 mois)
   │   └── ASP.NET Core 8 API
   │       ├── /api/*
   │       ├── /hubs/orders (SignalR WebSocket)
   │       └── /wwwroot/uploads (images)
   │
   └── Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
       └── tabhub DB (2 tenants, ~50 MB)
```

**URLs de production :**
- Frontend : `https://ashy-grass-0c75bb903.6.azurestaticapps.net`
- API : `https://tabhub-api-caguf5bkb7b9bzca.francecentral-01.azurewebsites.net`

**Coût mensuel estimé :** ~0 € pendant les 12 mois de free trial Azure.

### CI/CD GitHub Actions

```yaml
# backend.yml
push master → dotnet build → dotnet test → deploy App Service

# frontend.yml
push master → npm install → npm run build → deploy Static Web App
```

---

## 9. Tests automatisés

### Backend — xUnit + Testcontainers

- Tests d'intégration avec vraie DB PostgreSQL (Testcontainers)
- Couverture : Auth, Config, Spaces, Staff, Menu, Orders, Sessions, Reports, Admin
- Exécution : `dotnet test` (CI : `backend.yml`)

### Frontend — Vitest + MSW

- Tests unitaires et d'intégration des composants React
- MSW intercepte les appels API (pas de backend requis)
- Couverture : Login, Menu, Spaces, Staff, CustomerMenu, WaiterApp, KitchenApp
- Exécution : `npm test` (CI : `frontend.yml`)

### E2E — Playwright TypeScript

83 tests automatisés couvrant l'intégralité de la régression fonctionnelle :

| Module | Tests | Surface |
|--------|-------|---------|
| Auth & login | T-01–T-06 | Manager login, guard, logout |
| Configuration | T-07–T-09 | Nom, TVA, horaires |
| Espaces & tables | T-10–T-13 | Création, QR, suppression |
| Personnel | T-14–T-18 | CRUD staff, zones |
| Menu | T-19–T-24 | Catégories, items, modificateurs, ingrédients |
| PIN login | T-25–T-28 | Serveur, cuisine, caisse |
| Commande client | T-29–T-37 | Panier, placement, SignalR |
| Application serveur | T-38–T-45 | Notifications, ACK, avancement |
| Cuisine | T-46–T-49 | Kanban, minuteur, SignalR |
| Caisse | T-50–T-52 | Sessions, commandes emporter |
| Emporter | T-53–T-54 | Affichage live |
| Simulation E2E | T-55–T-56 | 5 contextes simultanés |
| Dashboard | T-57–T-59 | KPIs, revenus, QR |
| Isolation tenant | T-60–T-61 | Cross-tenant rejection |
| Navigation | T-62–T-64 | Routes, deep links |
| PDF | T-65 | Facture générée |
| Images | T-66–T-67 | Upload, grande image |
| Planification | T-68–T-69 | Menu scheduling actif/inactif |
| Multilinguisme | T-70–T-71 | FR/AR/EN, RTL |
| Cas limites | T-72–T-75 | Panier vide, indisponible, QR invalide, 404 |
| Super admin | T-76–T-83 | Login, tenants, managers |

**Caractéristiques :**
- Tests séquentiels (workers: 1) — la production est une DB persistante partagée
- Idempotents — les tests créent leurs propres données (préfixe `E2E`) et utilisent find-or-create
- Traces visuelles en cas d'échec (Playwright traces)
- Multi-contextes pour les tests SignalR (5 fenêtres simultanées)

---

## 10. Résultats et métriques

### Fonctionnalités livrées

- ✅ 7 surfaces applicatives distinctes
- ✅ Multi-tenant avec isolation complète
- ✅ Temps réel SignalR end-to-end (< 200 ms de latence)
- ✅ Trilingue FR / AR (RTL) / EN
- ✅ Génération PDF de factures (TVA, items, totaux)
- ✅ Planification de menus (TIME_RANGE, DAY_OF_WEEK)
- ✅ Upload d'images avec conversion WebP
- ✅ Audit log complet
- ✅ Déploiement cloud opérationnel (HTTPS, CI/CD)
- ✅ 83 tests E2E automatisés

### Volumétrie de code

| Couche | Fichiers | Lignes (approx.) |
|--------|----------|-----------------|
| Backend C# | ~50 fichiers | ~5 000 lignes |
| Frontend TypeScript/TSX | ~80 fichiers | ~8 000 lignes |
| Tests backend | ~15 fichiers | ~2 000 lignes |
| Tests E2E | ~25 fichiers | ~3 000 lignes |
| SQL / Config | ~10 fichiers | ~800 lignes |

---

## 11. Travaux futurs et commercialisation

### Roadmap technique immédiate

| Fonctionnalité | Priorité | Complexité |
|---------------|----------|------------|
| Application mobile native (React Native) | Haute | Haute |
| Azure SignalR Service (scale-out) | Haute | Moyenne |
| Paiement en ligne (Flouci / Stripe) | Haute | Haute |
| Système de fidélité client | Moyenne | Moyenne |
| Intégration imprimante thermique | Moyenne | Moyenne |
| Rapports avancés (export Excel/PDF) | Moyenne | Basse |
| Gestion des stocks et approvisionnement | Haute | Haute |
| Réservations en ligne | Basse | Moyenne |

### Modèle commercial

**Cible initiale :** Cafés et restaurants tunisiens urbains (Tunis, Sousse, Sfax)

| Plan | Prix/mois | Inclus |
|------|-----------|--------|
| Starter | 49 TND | 1 espace, 20 tables, 3 staff |
| Pro | 99 TND | 5 espaces, illimité tables/staff, analytics |
| Entreprise | Sur devis | Multi-établissements, support dédié |

**Avantage concurrentiel :**
1. **Prix** — 5–10× moins cher que les solutions occidentales
2. **Langue** — arabe natif (RTL), français, anglais
3. **Simplicité** — onboarding en 5 minutes, pas de formation requise
4. **Local** — support client tunisien, conformité fiscale tunisienne (TVA 7 %/19 %)

### Stratégie de lancement

1. **Phase pilote (mois 1–3)** — 5 restaurants tests à Tunis (gratuit contre feedback)
2. **Lancement public (mois 4)** — landing page, pricing, essai 30 jours gratuit
3. **Scale (mois 6–12)** — partenariats avec fournisseurs d'équipement restaurant

---

## 12. Conclusion

TabHub démontre qu'il est possible de construire un **système SaaS professionnel, multi-tenant et temps réel** en moins de 3 mois avec une stack moderne et des pratiques solides.

Les choix architecturaux (schéma-par-tenant, SignalR, SPA multi-surface) sont justifiés par des contraintes réelles du domaine restaurant :
- Isolation des données entre établissements
- Réactivité temps réel pour la coordination cuisine/salle
- Interface unique pour 7 profils d'utilisateurs différents

La couverture de tests (83 E2E + tests unitaires backend et frontend) garantit une base solide pour l'évolution du produit.

TabHub est **opérationnel en production** sur Azure, accessible depuis n'importe quel téléphone via un simple QR code. Il constitue une base commercialement viable pour adresser le marché de la restauration tunisienne et, à terme, la région MENA.

---

*Rapport rédigé dans le cadre du projet de fin d'études — 2024–2025*

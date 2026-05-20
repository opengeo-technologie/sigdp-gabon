# SIGDP-GABON - Système d'Information pour la Gestion des Débarcadères et de la Pêche au Gabon

## 📋 Description

Application complète de gestion des débarcadères de pêche au Gabon, développée pour le Ministère de la Mer, de la Pêche et l'Economie Bleue - Direction des Pêches et de l'Aquaculture (DPA).

### Technologies utilisées

- **Backend**: FastAPI (Python)
- **Frontend**: Angular 19
- **Styling**: MaterializeCSS
- **Base de données**: PostgreSQL avec extension PostGIS
- **Cartographie**: Leaflet.js

## 🏗️ Architecture

```
sigdp-gabon/
├── backend/          # API FastAPI
│   ├── app/
│   │   ├── models/   # Modèles SQLAlchemy
│   │   ├── schemas/  # Schémas Pydantic
│   │   ├── api/      # Routes API
│   │   ├── config.py
│   │   └── database.py
│   ├── main.py
│   └── requirements.txt
│
└── frontend/         # Application Angular 19
    ├── src/
    │   ├── app/
    │   │   ├── components/
    │   │   ├── services/
    │   │   ├── models/
    │   │   └── app.routes.ts
    │   ├── environments/
    │   └── styles.scss
    └── package.json
```

## 🚀 Installation et démarrage

### Prérequis

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ avec PostGIS
- npm ou yarn

### 1. Configuration de la base de données

```bash
# Créer la base de données PostgreSQL
createdb sigdp_gabon

# Activer l'extension PostGIS
psql -d sigdp_gabon -c "CREATE EXTENSION postgis;"
```

### 2. Installation du Backend

```bash
cd backend

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Démarrer le serveur
python main.py
```

Le backend sera accessible sur `http://localhost:8000`
Documentation API: `http://localhost:8000/api/docs`

### 3. Installation du Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm start
```

Le frontend sera accessible sur `http://localhost:4200`

## 📚 Fonctionnalités principales

### Module Débarcadères

- ✅ Liste et filtrage des débarcadères
- ✅ Création et modification de débarcadères
- ✅ Géolocalisation GPS (PostGIS)
- ✅ Visualisation cartographique (Leaflet)
- ✅ Gestion des infrastructures
- ✅ Affectation des agents responsables

### Modules à venir

- 🔄 Gestion des pêcheurs
- 🔄 Gestion des bateaux
- 🔄 Référentiel des espèces halieutiques
- 🔄 Enregistrement des débarquements
- 🔄 Statistiques et tableaux de bord
- 🔄 Système d'alertes
- 🔄 Application mobile (Flutter/React Native)

## 🗺️ API Endpoints

### Débarcadères

- `GET /api/debarcaderes` - Liste des débarcadères (avec filtres)
- `GET /api/debarcaderes/{id}` - Détails d'un débarcadère
- `GET /api/debarcaderes/code/{code}` - Recherche par code
- `POST /api/debarcaderes` - Créer un débarcadère
- `PUT /api/debarcaderes/{id}` - Mettre à jour un débarcadère
- `DELETE /api/debarcaderes/{id}` - Supprimer un débarcadère
- `GET /api/debarcaderes/geojson/all` - Export GeoJSON

## 🎨 Captures d'écran

### Tableau de bord

Vue d'ensemble des statistiques clés du système.

### Liste des débarcadères

Gestion complète avec filtres par province, type et statut.

### Carte interactive

Visualisation géographique avec marqueurs colorés par milieu (maritime, fluvial, lagunaire).

## 🔒 Sécurité

- Authentification JWT (à implémenter)
- Validation des données avec Pydantic
- Protection CORS
- Sanitization des entrées utilisateur
- Chiffrement des données sensibles

## 📝 Variables d'environnement

```env
# Backend (.env)
DATABASE_URL=postgresql://user:password@localhost:5432/sigdp_gabon
SECRET_KEY=your-secret-key
DEBUG=True
CORS_ORIGINS=http://localhost:4200
```

## 🤝 Contribution

Ce projet est développé pour le Ministère des Eaux et Forêts du Gabon.

## 📄 Licence

Propriétaire - Ministère des Eaux et Forêts, République Gabonaise

## 👥 Équipe

- **Maître d'ouvrage**: Direction des Pêches et de l'Aquaculture (DPA)
- **Développement**: DJATIO TCHOTEZO Stephane

## 📞 Support

Pour toute question ou assistance technique:

- Email: support@sigdp-gabon.ga
- Téléphone: +241 XX XX XX XX

---

**Version**: 1.0.0  
**Date**: Avril 2025  
**Statut**: En développement

# sigdp-gabon

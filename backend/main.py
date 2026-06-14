import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app.api import (
    debarcaderes,
    pecheurs,
    bateaux,
    especes,
    debarquements,
    statistiques,
    statistiques_evolution,
    auth,
    rapports,
    profile,
    permissions,
    licence2,
    armement_coorperative,
    engin_peche,
    signataire,
)

# Créer les tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API pour le Système d'Information pour la Gestion des Débarcadères et de la Pêche au Gabon",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Absolute path to your media folder
MEDIA_DIR = os.path.join(os.getcwd(), "uploads")

# Mount it
app.mount("/uploads", StaticFiles(directory=MEDIA_DIR), name="uploads")

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routers
app.include_router(signataire.router)
app.include_router(licence2.router)
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(permissions.router)
app.include_router(armement_coorperative.router)
app.include_router(debarcaderes.router)
app.include_router(pecheurs.router)
app.include_router(bateaux.router)
app.include_router(especes.router)
app.include_router(engin_peche.router)
app.include_router(debarquements.router)
app.include_router(statistiques.router)
app.include_router(statistiques_evolution.router)
app.include_router(rapports.router)


@app.get("/")
def root():
    return {
        "message": "Bienvenue sur l'API SIGDP-GABON",
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)

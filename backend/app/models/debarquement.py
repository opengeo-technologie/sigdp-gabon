from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
    LargeBinary,
    Boolean,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.database import Base


class Debarquement(Base):
    __tablename__ = "debarquements"

    id = Column(Integer, primary_key=True, index=True)
    numero_debarquement = Column(String(50), unique=True, nullable=False, index=True)

    # Références
    debarcadere_id = Column(Integer, ForeignKey("debarcaderes.id"), nullable=False)
    bateau_id = Column(Integer, ForeignKey("bateaux.id"), nullable=False)
    pecheur_principal_id = Column(Integer, ForeignKey("pecheurs.id"), nullable=False)

    # Date et heures du débarquement
    date_debarquement = Column(DateTime(timezone=True), nullable=False)
    date_depart_peche = Column(DateTime(timezone=True), nullable=True)
    heure_depart_peche = Column(DateTime(timezone=True))
    heure_arrivee_debarcadere = Column(DateTime(timezone=True))
    duree_sortie_heures = Column(Float)

    # Localisation de la zone de pêche
    zone_peche_nom = Column(String(200))
    zone_peche_geom = Column(Geometry("POINT", srid=4326))
    zone_peche_latitude = Column(Float)
    zone_peche_longitude = Column(Float)
    zone_peche_profondeur_m = Column(Float)

    # Conditions météo
    meteo_conditions = Column(String(100))  # Ensoleillé, Nuageux, Pluvieux, Tempête
    meteo_etat_mer = Column(String(100))  # Calme, Agitée, Houleuse
    meteo_temperature_c = Column(Float)

    # Équipage
    nombre_pecheurs = Column(Integer)
    liste_pecheurs_ids = Column(Text)  # Liste d'IDs séparés par virgules

    # Photo du débarquement
    photo_captures = Column(LargeBinary)
    photo_captures_url = Column(String(500))

    # Validation
    agent_controle_nom = Column(String(200))
    agent_controle_matricule = Column(String(50))
    signature_pecheur = Column(LargeBinary)
    signature_agent = Column(LargeBinary)

    # Alertes
    alerte_espece_protegee = Column(Boolean, default=False)
    alerte_quota_depasse = Column(Boolean, default=False)
    alerte_taille_illegale = Column(Boolean, default=False)
    alerte_bateau_non_conforme = Column(Boolean, default=False)
    alerte_details = Column(Text)

    # Observations
    observations = Column(Text)
    anomalies_detectees = Column(Text)

    # Synchronisation (pour mode offline)
    synchronise = Column(Boolean, default=True)
    date_synchronisation = Column(DateTime(timezone=True))

    # Métadonnées
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Debarquement {self.numero_debarquement} - {self.date_debarquement}>"


class DetailDebarquement(Base):
    """
    Détails des espèces débarquées pour chaque débarquement
    """

    __tablename__ = "details_debarquements"

    id = Column(Integer, primary_key=True, index=True)
    debarquement_id = Column(Integer, ForeignKey("debarquements.id"), nullable=False)
    espece_id = Column(Integer, ForeignKey("especes.id"), nullable=False)

    # Quantités
    quantite_kg = Column(Float, nullable=False)
    nombre_individus = Column(Integer)

    # Tailles (pour vérification TML)
    taille_moyenne_cm = Column(Float)
    taille_min_cm = Column(Float)
    taille_max_cm = Column(Float)

    # Prix
    prix_unitaire_kg = Column(Float)  # Prix de vente en FCFA/kg
    valeur_totale = Column(Float)  # Prix total en FCFA

    # État du poisson
    etat_fraicheur = Column(String(50))  # Très frais, Frais, Acceptable, Douteux
    destination = Column(String(100))  # Marché local, Export, Transformation

    # Alertes spécifiques à cette espèce
    alerte_taille_illegale = Column(Boolean, default=False)
    alerte_quota = Column(Boolean, default=False)

    # Métadonnées
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<DetailDebarquement {self.id} - Espèce {self.espece_id}>"

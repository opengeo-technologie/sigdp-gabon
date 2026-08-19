from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Enum,
    Boolean,
    Text,
    LargeBinary,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class CategorieEspece(str, enum.Enum):
    PELAGIQUE = "PELAGIQUE"
    DEMERSAL = "DEMERSAL"
    EAU_DOUCE = "EAU DOUCE"
    CRUSTACE = "CRUSTACE"
    MOLLUSQUE = "MOLLUSQUE"
    PROTEGE = "PROTEGE"


class StatutReglementaire(str, enum.Enum):
    LIBRE = "Libre"
    SOUS_QUOTA = "Sous quota"
    PROTEGE = "Protégé"
    SAISONNIER = "Saisonnier"


class Espece(Base):
    __tablename__ = "especes"

    id = Column(Integer, primary_key=True, index=True)
    code_espece = Column(
        String(20), unique=True, nullable=False, index=True
    )  # Code FAO ou national

    # Nomenclature
    nom_scientifique = Column(String(200), nullable=False)
    nom_commun_francais = Column(String(200), nullable=False)
    nom_commun_fang = Column(String(200))
    nom_commun_myene = Column(String(200))
    autres_noms_locaux = Column(Text)

    # Classification
    categorie = Column(Enum(CategorieEspece), nullable=False)
    famille = Column(String(100))
    ordre = Column(String(100))
    classe = Column(String(100))

    # Photo de référence
    photo = Column(LargeBinary)
    photo_url = Column(String(500))

    # Statut réglementaire
    statut_reglementaire = Column(
        Enum(StatutReglementaire), nullable=False, default=StatutReglementaire.LIBRE
    )
    taille_minimale_legale_cm = Column(Float)  # TML en centimètres

    # Quotas
    quota_annuel_tonnes = Column(Float)
    quota_mensuel_tonnes = Column(Float)
    quota_hebdomadaire_tonnes = Column(Float)

    # Saisonnalité
    saison_peche_debut = Column(String(20))  # Mois de début (ex: "Janvier")
    saison_peche_fin = Column(String(20))  # Mois de fin
    saison_reproduction_debut = Column(String(20))
    saison_reproduction_fin = Column(String(20))

    # Valeur commerciale
    prix_reference_kg_min = Column(Float)  # Prix min en FCFA/kg
    prix_reference_kg_max = Column(Float)  # Prix max en FCFA/kg

    # Informations biologiques
    habitat = Column(Text)  # Description de l'habitat
    alimentation = Column(Text)
    taille_maximale_cm = Column(Float)
    poids_maximal_kg = Column(Float)
    esperance_vie_annees = Column(Integer)

    # Importance écologique
    importance_ecologique = Column(Text)
    vulnerabilite_surpeche = Column(String(20))  # Faible, Moyenne, Élevée, Critique

    # Statut
    actif = Column(Boolean, default=True)

    # Métadonnées
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    captures = relationship("CaptureEstimee", back_populates="espece")

    def __repr__(self):
        return f"<Espece {self.code_espece} - {self.nom_commun_francais}>"

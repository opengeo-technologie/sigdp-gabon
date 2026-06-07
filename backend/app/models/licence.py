from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from datetime import date, timedelta
from app.database import Base


class LicenceAutorisationPeche(Base):
    """Modèle pour les licences et autorisations de pêche"""

    __tablename__ = "licences_autorisation_peche"

    id = Column(Integer, primary_key=True, index=True)

    # Informations licence
    numero_licence = Column(String(50), unique=True, nullable=False, index=True)
    type_licence = Column(
        String(50), nullable=False
    )  # artisanale, industrielle, semi-industrielle
    categorie = Column(
        String(50), nullable=True
    )  # peche_cotiere, peche_hauturiere, peche_continentale

    # Titulaire (pêcheur ou entreprise)
    pecheur_id = Column(Integer, ForeignKey("pecheurs.id"), nullable=True)
    # entreprise_id = Column(Integer, ForeignKey("entreprises.id"), nullable=True)

    # Dates
    annee_validite = Column(Integer, nullable=False)  # ex: 2024
    date_emission = Column(Date, nullable=True)
    date_debut = Column(Date, nullable=False)
    date_expiration = Column(Date, nullable=False)

    # Zone de pêche
    zone_peche = Column(
        String(100)
    )  # ex: "Estuaire du Komo", "Zone Economique Exclusive"
    coordonnees_zone = Column(Text)  # JSON avec polygone de la zone

    # Types de pêche autorisés
    types_peche_autorises = Column(Text)  # JSON: ["chalut", "filet", "ligne"]
    especes_autorisees = Column(Text)  # JSON: liste des espèces ou "toutes"

    # Quotas et limitations
    quota_annuel_kg = Column(Numeric(10, 2))  # Quota en kg
    taille_minimale_maille = Column(Numeric(5, 2))  # Taille maille filet en cm
    profondeur_max_metres = Column(Integer)

    # Bateau associé (si applicable)
    bateau_id = Column(Integer, ForeignKey("bateaux.id"), nullable=True)
    nombre_embarcations_max = Column(Integer, default=1)

    # Équipage
    nombre_pecheurs_max = Column(Integer)

    # Financier
    montant_paye = Column(Numeric(10, 2))
    mode_paiement = Column(String(50))  # especes, virement, cheque
    reference_paiement = Column(String(100))

    # Statut
    statut = Column(
        String(20), default="active"
    )  # active, expiree, suspendue, revoquee
    raison_suspension = Column(Text)
    date_suspension = Column(Date)

    # Renouvellement
    est_renouvellement = Column(Boolean, default=False)
    licence_precedente_id = Column(
        Integer, ForeignKey("licences_autorisation_peche.id")
    )

    # Autorité émettrice
    autorite_emission = Column(String(100))  # Ministère des Eaux et Forêts
    agent_emission = Column(String(100))
    bureau_emission = Column(String(100))
    pour_ordre = Column(Boolean, default=False)
    signataire_id = Column(Integer, nullable=True)

    # Documents
    document_scan = Column(String(255))  # Chemin vers scan de la licence

    # Remarques
    remarques = Column(Text)

    # Actif
    actif = Column(Boolean, default=True)

    # Relations
    # pecheur = relationship("Pecheur", back_populates="licences")
    # bateau = relationship("Bateau", back_populates="licences")
    # entreprise = relationship("Entreprise", back_populates="licences")

    # Historique des inspections
    # inspections = relationship("InspectionLicence", back_populates="licence")

    # Violations associées
    # violations = relationship("ViolationLicence", back_populates="licence")

    def est_active(self) -> bool:
        """Vérifier si la licence est active"""
        if self.statut != "active":
            return False
        if self.date_expiration < date.today():
            return False
        return True

    def jours_avant_expiration(self) -> int:
        """Nombre de jours avant expiration"""
        if self.date_expiration < date.today():
            return 0
        return (self.date_expiration - date.today()).days

    def necessite_renouvellement(self) -> bool:
        """Vérifier si la licence doit être renouvelée (30 jours avant)"""
        return 0 < self.jours_avant_expiration() <= 30

    def calculer_duree_mois(self) -> int:
        """Calculer la durée en mois"""
        delta = self.date_expiration - self.date_debut
        return delta.days // 30


class RoleSignataire(Base):
    """Rôles des signataires de licences"""

    __tablename__ = "roles_signataires"

    id = Column(Integer, primary_key=True, index=True)
    nom_role = Column(
        String(50), unique=True, nullable=False
    )  # ex: Directeur, Chef de Service
    abbreviation = Column(String(20), unique=True, nullable=False)  # ex: DIR, CS
    description = Column(Text)


class Signataire(Base):
    """Signataires de licences"""

    __tablename__ = "signataires"

    id = Column(Integer, primary_key=True, index=True)
    nom_complet = Column(String(100), nullable=False)
    role_id = Column(Integer, ForeignKey("roles_signataires.id"), nullable=False)
    organisme = Column(
        String(200),
        default="Ministère de la Mer, de la Pêche Bleue et de l'Économie Maritime",
    )
    contact_email = Column(String(100))
    contact_telephone = Column(String(20))
    is_actif = Column(Boolean, default=True)

    # role = relationship("RoleSignataire")


class SignataireLicence(Base):
    """Association entre licences et signataires"""

    __tablename__ = "signataires_licences"

    id = Column(Integer, primary_key=True, index=True)
    licence_id = Column(
        Integer, ForeignKey("licences_autorisation_peche.id"), nullable=False
    )
    signataire_id = Column(Integer, ForeignKey("signataires.id"), nullable=False)
    date_signature = Column(Date, nullable=False)
    remarques = Column(Text)


# class InspectionLicence(Base):
#     """Inspections et contrôles des licences"""

#     __tablename__ = "inspections_licences"

#     id = Column(Integer, primary_key=True, index=True)

#     licence_id = Column(
#         Integer, ForeignKey("licences_autorisation_peche.id"), nullable=False
#     )

#     date_inspection = Column(Date, nullable=False)
#     lieu_inspection = Column(String(100))

#     type_inspection = Column(String(50))  # terrain, bureau, aleatoire
#     inspecteur = Column(String(100))
#     organisme = Column(String(100))

#     # Résultat
#     conforme = Column(Boolean)
#     remarques = Column(Text)
#     mesures_correctives = Column(Text)

#     # Documents
#     rapport_scan = Column(String(255))

#     # Relation
#     licence = relationship("LicencePeche", back_populates="inspections")


# class ViolationLicence(Base):
#     """Violations et infractions liées aux licences"""

#     __tablename__ = "violations_licences"

#     id = Column(Integer, primary_key=True, index=True)

#     licence_id = Column(
#         Integer, ForeignKey("licences_autorisation_peche.id"), nullable=False
#     )

#     date_violation = Column(Date, nullable=False)
#     type_violation = Column(
#         String(100)
#     )  # peche_zone_interdite, quota_depasse, espece_interdite

#     description = Column(Text)
#     lieu = Column(String(100))

#     # Sanction
#     type_sanction = Column(String(50))  # avertissement, amende, suspension
#     montant_amende = Column(Numeric(10, 2))
#     duree_suspension_jours = Column(Integer)

#     # Statut
#     statut = Column(String(20), default="en_cours")  # en_cours, reglee, contestee
#     date_reglement = Column(Date)

#     # Agent verbalisateur
#     agent = Column(String(100))

#     # Relation
#     licence = relationship("LicencePeche", back_populates="violations")


# class RenouvellementLicence(Base):
#     """Demandes de renouvellement de licences"""

#     __tablename__ = "renouvellements_licences"

#     id = Column(Integer, primary_key=True, index=True)

#     licence_actuelle_id = Column(
#         Integer, ForeignKey("licences_peche.id"), nullable=False
#     )

#     date_demande = Column(Date, nullable=False)
#     date_traitement = Column(Date)

#     # Statut demande
#     statut = Column(String(20), default="en_attente")  # en_attente, approuve, rejete
#     motif_rejet = Column(Text)

#     # Nouvelle licence générée
#     nouvelle_licence_id = Column(Integer, ForeignKey("licences_peche.id"))

#     # Agent traitant
#     agent_traitement = Column(String(100))

#     remarques = Column(Text)

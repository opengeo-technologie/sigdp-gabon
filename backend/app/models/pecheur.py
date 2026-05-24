from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    Enum,
    Boolean,
    LargeBinary,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class CategoriePecheur(str, enum.Enum):
    ARTISANAL = "Pêcheur artisanal"
    SEMI_INDUSTRIEL = "Pêcheur semi-industriel"
    PATRON = "Propriétaire de bateau"
    AIDE_PECHEUR = "Aide-pêcheur"


class TypePeche(str, enum.Enum):
    COTIERE = "Côtière"
    CONTINENTALE = "Continentale"
    LAGUNAIRE = "Lagunaire"
    HAUTURIERE = "Hauturière"


class StatutPecheur(str, enum.Enum):
    ACTIF = "Actif"
    INACTIF = "Inactif"
    SUSPENDU = "Suspendu"
    DECEDE = "Décédé"


class Pecheur(Base):
    __tablename__ = "pecheurs"

    id = Column(Integer, primary_key=True, index=True)
    numero_carte = Column(
        String(50), unique=True, nullable=False, index=True
    )  # CNP-XXXX-XXXX

    # Informations civiles
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=True)
    date_naissance = Column(Date, nullable=True)
    lieu_naissance = Column(String(100), nullable=True)
    nationalite = Column(String(50), nullable=False, default="Gabonaise")
    type_carte = Column(String(100), nullable=True)
    numero_piece_identite = Column(String(100), unique=True, nullable=False)

    # Photo et biométrie
    photo_url = Column(String(200), nullable=True)  # URL de la photo
    qr_code_url = Column(String(200), nullable=True)  # URL du QR code
    empreinte_digitale = Column(
        LargeBinary, nullable=True
    )  # Empreinte stockée en binaire

    # Contact
    telephone = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    adresse = Column(String(200), nullable=True)

    # Catégorisation
    categorie = Column(Enum(CategoriePecheur), nullable=False)
    # type_peche = Column(Enum(TypePeche), nullable=False)

    # Débarcadère habituel
    debarcadere_habituel_code = Column(
        String(50), nullable=True
    )  # Code du débarcadère habituel
    debarcadere_habituel_nom = Column(String(200), nullable=True)

    # Contacts d'urgence
    contact_urgence_nom = Column(String(100), nullable=True)
    contact_urgence_telephone = Column(String(100), nullable=True)
    contact_urgence_relation = Column(String(50), nullable=True)

    # Statut
    statut = Column(Enum(StatutPecheur), nullable=False, default=StatutPecheur.ACTIF)

    # Métadonnées
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # RelationShips
    equipages = relationship("Equipage", back_populates="pecheur")

    def __repr__(self):
        return f"<Pecheur {self.numero_carte} - {self.nom} {self.prenom}>"

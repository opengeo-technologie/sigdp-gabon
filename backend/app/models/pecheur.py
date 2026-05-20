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
    PATRON = "Patron de pêche"
    AIDE_PECHEUR = "Aide-pêcheur"


class TypePeche(str, enum.Enum):
    COTIERE = "Côtière"
    FLUVIALE = "Fluviale"
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
    prenom = Column(String(100), nullable=False)
    date_naissance = Column(Date, nullable=False)
    lieu_naissance = Column(String(100))
    nationalite = Column(String(50), nullable=False, default="Gabonaise")
    nif = Column(String(20))  # Numéro d'Identification Fiscale

    # Photo et biométrie
    photo = Column(LargeBinary)  # Photo stockée en binaire
    photo_url = Column(String(200))  # URL de la photo
    qr_code_url = Column(String(200))  # URL du QR code
    empreinte_digitale = Column(LargeBinary)  # Empreinte stockée en binaire

    # Contact
    telephone = Column(String(20))
    email = Column(String(100))
    adresse = Column(String(200))

    # Catégorisation
    categorie = Column(Enum(CategoriePecheur), nullable=False)
    type_peche = Column(Enum(TypePeche), nullable=False)

    # Débarcadère habituel
    debarcadere_habituel_code = Column(String(50))

    # Licence de pêche
    licence_numero = Column(String(50))
    licence_date_delivrance = Column(Date)
    licence_date_expiration = Column(Date)
    licence_qr_code = Column(LargeBinary)  # QR code de la licence

    # Contacts d'urgence
    contact_urgence_nom = Column(String(100))
    contact_urgence_telephone = Column(String(20))
    contact_urgence_relation = Column(String(50))

    # Statut
    statut = Column(Enum(StatutPecheur), nullable=False, default=StatutPecheur.ACTIF)

    # Métadonnées
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # RelationShips
    equipages = relationship("Equipage", back_populates="pecheur")

    def __repr__(self):
        return f"<Pecheur {self.numero_carte} - {self.nom} {self.prenom}>"

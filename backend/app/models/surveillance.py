from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from datetime import date, timedelta
from app.database import Base


class Infraction(Base):
    """Infractions et violations liées au controle de la pêche"""

    __tablename__ = "infractions"

    id = Column(Integer, primary_key=True, index=True)
    libelle_infra = Column(String(100), nullable=False)
    type_infra = Column(String(50))  # mineure, majeure, critique
    description = Column(Text, nullable=True)
    sanction_proposee = Column(String(100), nullable=True)


class AgentSurveillance(Base):
    """Agents de surveillance"""

    __tablename__ = "agents_surveillance"

    id = Column(Integer, primary_key=True, index=True)
    matricule = Column(String(100), nullable=False)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    date_naissance = Column(Date, nullable=True)
    fonction = Column(String(100))
    organisme = Column(String(100))
    contact_email = Column(String(100))
    contact_telephone = Column(String(20))


# class MissionSurveillance(Base):
#     """Missions de surveillance"""

#     __tablename__ = "missions_surveillance"

#     id = Column(Integer, primary_key=True, index=True)
#     date_depart = Column(Date, nullable=False)
#     date_retour = Column(Date, nullable=True)
#     lieu_mission = Column(String(100), nullable=True)
#     type_mission = Column(String(50))  # terrain, bureau, aleatoire
#     moyen_controle = Column(String(100))

#     # Documents
#     rapport_scan = Column(String(255))


# class EquipeSurveillance(Base):
#     """Équipes de surveillance"""

#     __tablename__ = "equipes_surveillance"

#     id = Column(Integer, primary_key=True, index=True)
#     mission_id = Column(Integer, ForeignKey("missions_surveillance.id"), nullable=False)
#     agent_id = Column(Integer, ForeignKey("agents_surveillance.id"), nullable=False)
#     role_agent = Column(String(100))  # chef d'équipe, membre, etc.

#     mission = relationship("MissionSurveillance", backref="equipes")
#     agent = relationship("AgentSurveillance", backref="equipes")


# class RapportSurveillance(Base):
#     """Rapports de surveillance"""

#     __tablename__ = "rapports_surveillance"

#     id = Column(Integer, primary_key=True, index=True)
#     mission_id = Column(Integer, ForeignKey("missions_surveillance.id"), nullable=False)
#     date_rapport = Column(Date, nullable=False)
#     contenu_rapport = Column(Text, nullable=True)

#     mission = relationship("MissionSurveillance", backref="rapports")


# class OperationSurveillance(Base):
#     """Opérations de surveillance"""

#     __tablename__ = "operations_surveillance"

#     id = Column(Integer, primary_key=True, index=True)
#     mission_id = Column(Integer, ForeignKey("missions_surveillance.id"), nullable=False)
#     date_operation = Column(Date, nullable=False)
#     lieu_operation = Column(String(100), nullable=True)
#     type_operation = Column(String(50))  # inspection, contrôle, etc.
#     resultat = Column(String(100))  # conforme, non conforme, etc.
#     remarques = Column(Text)

#     mission = relationship("MissionSurveillance", backref="operations")


# class InfractionSurveillance(Base):
#     """Infractions relevées lors des missions de surveillance"""

#     __tablename__ = "infractions_surveillance"

#     id = Column(Integer, primary_key=True, index=True)
#     operation_id = Column(
#         Integer, ForeignKey("operations_surveillance.id"), nullable=False
#     )
#     date_infraction = Column(Date, nullable=False)
#     infraction_id = Column(Integer, ForeignKey("infractions.id"), nullable=False)
#     bateau_id = Column(Integer, ForeignKey("bateaux.id"), nullable=True)
#     description_infraction = Column(Text, nullable=True)
#     gravite_infraction = Column(String(50))  # mineure, majeure, critique
#     sanction_proposee = Column(String(100), nullable=True)

#     mission = relationship("MissionSurveillance", backref="infractions")


# class SaisieInfraction(Base):
#     """Saisie des infractions relevées lors des missions de surveillance"""

#     __tablename__ = "saisies_infractions"

#     id = Column(Integer, primary_key=True, index=True)
#     infraction_id = Column(
#         Integer, ForeignKey("infractions_surveillance.id"), nullable=False
#     )
#     date_saisie = Column(Date, nullable=False)
#     agent_id = Column(Integer, ForeignKey("agents_surveillance.id"), nullable=True)
#     remarques = Column(Text, nullable=True)

#     infraction = relationship("InfractionSurveillance", backref="saisies")
#     agent = relationship("AgentSurveillance", backref="saisies")

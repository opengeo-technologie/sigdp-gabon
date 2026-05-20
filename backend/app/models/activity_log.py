from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class ActivityLog(Base):
    """
    Modèle pour l'historique des activités utilisateurs
    """

    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(
        String(50), nullable=False
    )  # login, logout, create, update, delete, export, etc.
    description = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv4 ou IPv6
    user_agent = Column(String(255), nullable=True)
    date = Column(DateTime, default=datetime.now, nullable=False)

    # Relations
    user = relationship("User", back_populates="activities")


# Ajouter la relation dans le modèle User
"""
Dans app/models/user.py, ajouter :

from sqlalchemy.orm import relationship

class User(Base):
    # ... champs existants ...
    
    # Relations
    activities = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
    
    # Champs additionnels pour le profil
    telephone = Column(String(20), nullable=True)
    adresse = Column(Text, nullable=True)
    ville = Column(String(100), nullable=True)
    code_postal = Column(String(10), nullable=True)
    pays = Column(String(100), default='Gabon')
    photo_profil = Column(String(255), nullable=True)
    signature = Column(Text, nullable=True)
    preferences = Column(JSON, default={})
"""

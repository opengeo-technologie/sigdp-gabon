from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Boolean,
    DateTime,
    Enum as SQLEnum,
    Text,
    JSON,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base

import app.models.activity_log  # Importer pour éviter les erreurs de relation circulaire
from app.models.permission import (
    user_permissions,
)  # Importer pour éviter les erreurs de relation circulaire


class UserRole(str, enum.Enum):
    SUPERADMIN = "super_admin"
    ADMIN = "admin"
    GESTIONNAIRE = "gestionnaire_peche"
    OPERATEUR = "operateur_saisie"
    ANALYSTE = "analyste"
    CONSULTANT = "consultant_externe"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Informations d'authentification
    email = Column(String(200), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Informations personnelles
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    telephone = Column(String(20))
    adresse = Column(Text, nullable=True)
    ville = Column(String(100), nullable=True)
    code_postal = Column(String(10), nullable=True)
    pays = Column(String(100), default="Gabon")
    photo_profil = Column(String(255), nullable=True)
    signature = Column(Text, nullable=True)
    preferences = Column(JSON, default={})

    # Rôle et permissions
    role = Column(SQLEnum(UserRole), nullable=True, default=UserRole.CONSULTANT)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    # Affectation
    debarcadere_affecte = Column(String(50))  # Code du débarcadère
    province_affectee = Column(String(100))

    # Métadonnées
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())

    # Relations
    activities = relationship(
        "ActivityLog", back_populates="user", cascade="all, delete-orphan"
    )
    role_obj = relationship("Role", back_populates="users")
    permissions = relationship(
        "Permission",
        secondary=user_permissions,
        back_populates="users",
        foreign_keys=[user_permissions.c.user_id, user_permissions.c.permission_id],
    )

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"

    def has_permission(self, permission_code: str) -> bool:
        """Vérifier si l'utilisateur a une permission spécifique"""
        # Vérifier permissions directes
        if any(p.code == permission_code and p.actif for p in self.permissions):
            return True

        # Vérifier permissions du rôle
        if self.role_obj:
            return any(
                p.code == permission_code and p.actif for p in self.role_obj.permissions
            )

        return False

    def has_any_permission(self, permission_codes: list) -> bool:
        """Vérifier si l'utilisateur a au moins une des permissions"""
        return any(self.has_permission(code) for code in permission_codes)

    def has_all_permissions(self, permission_codes: list) -> bool:
        """Vérifier si l'utilisateur a toutes les permissions"""
        return all(self.has_permission(code) for code in permission_codes)

    def get_all_permissions(self) -> list:
        """Obtenir toutes les permissions de l'utilisateur"""
        perms = set()

        # Permissions directes
        perms.update(p.code for p in self.permissions if p.actif)

        # Permissions du rôle
        if self.role_obj:
            perms.update(p.code for p in self.role_obj.permissions if p.actif)

        return list(perms)

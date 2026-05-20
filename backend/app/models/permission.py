from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base

# Table d'association Many-to-Many entre User et Permission
user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column(
        "user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    ),
    Column(
        "permission_id",
        Integer,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("granted_at", DateTime, default=datetime.now),
    Column(
        "granted_by",
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    ),
)

# Table d'association Many-to-Many entre Role et Permission
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    ),
    Column(
        "permission_id",
        Integer,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("created_at", DateTime, default=datetime.now),
)


class Permission(Base):
    """
    Modèle pour les permissions du système
    """

    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(
        String(100), unique=True, nullable=False, index=True
    )  # Ex: "debarquement.create"
    nom = Column(String(100), nullable=False)
    description = Column(String(255))
    module = Column(
        String(50), nullable=False, index=True
    )  # Ex: "debarquement", "pecheur", "rapport"
    action = Column(
        String(50), nullable=False
    )  # Ex: "create", "read", "update", "delete", "export"
    actif = Column(Boolean, default=True)
    date_creation = Column(DateTime, default=datetime.now)

    # Relations
    users = relationship(
        "User",
        secondary=user_permissions,
        back_populates="permissions",
        foreign_keys=[user_permissions.c.user_id, user_permissions.c.permission_id],
    )
    roles = relationship(
        "Role", secondary=role_permissions, back_populates="permissions"
    )


class Role(Base):
    """
    Modèle pour les rôles avec permissions
    Extension du concept de rôle simple (admin, gestionnaire, etc.)
    """

    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(
        String(50), unique=True, nullable=False, index=True
    )  # Ex: "admin", "gestionnaire_peche"
    nom = Column(String(100), nullable=False)
    description = Column(String(255))
    niveau = Column(Integer, default=1)  # Hiérarchie: 1=bas, 10=haut
    actif = Column(Boolean, default=True)
    est_systeme = Column(
        Boolean, default=False
    )  # True pour les rôles par défaut (non modifiables)
    date_creation = Column(DateTime, default=datetime.now)

    # Relations
    permissions = relationship(
        "Permission", secondary=role_permissions, back_populates="roles"
    )
    users = relationship("User", back_populates="role_obj")

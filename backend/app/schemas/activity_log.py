# app/schemas/activity_log.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ActivityLogBase(BaseModel):
    """Schéma de base pour les logs d'activité"""

    action: str
    description: str
    details: Optional[str] = None
    module: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ActivityLogCreate(ActivityLogBase):
    """Création d'un log d'activité"""

    user_id: int


class ActivityLogInDB(ActivityLogBase):
    """Log depuis la base de données"""

    id: int
    user_id: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityLogResponse(ActivityLogInDB):
    """Réponse API avec informations utilisateur"""

    username: Optional[str] = None
    user_email: Optional[str] = None


class ActivityLogFilter(BaseModel):
    """Filtres pour recherche de logs"""

    user_id: Optional[int] = None
    action: Optional[str] = None
    module: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    status: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    search: Optional[str] = None  # Recherche dans description


class ActivityStats(BaseModel):
    """Statistiques d'activité"""

    total_actions: int
    actions_by_type: dict  # {"login": 150, "create": 45, ...}
    actions_by_module: dict  # {"pecheur": 100, "bateau": 80, ...}
    actions_by_user: dict  # {1: 250, 2: 180, ...}
    actions_by_status: dict  # {"success": 490, "failure": 10}
    most_active_users: list  # [(user_id, count), ...]
    recent_activities: list  # Dernières activités

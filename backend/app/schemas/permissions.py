from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from app.models.bateau import TypeBateau, Propulsion, MateriauCoque


# ==================== Modèles Pydantic ====================


class PermissionBase(BaseModel):
    code: str
    nom: str
    description: Optional[str] = None
    module: str
    action: str
    actif: bool = True


class PermissionCreate(PermissionBase):
    pass


class PermissionResponse(PermissionBase):
    id: int
    date_creation: datetime

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    code: str
    nom: str
    description: Optional[str] = None
    niveau: int = 1
    actif: bool = True


class RoleCreate(RoleBase):
    permission_ids: List[int] = []


class RoleUpdate(BaseModel):
    nom: Optional[str] = None
    description: Optional[str] = None
    niveau: Optional[int] = None
    actif: Optional[bool] = None
    permission_ids: Optional[List[int]] = None


class RoleResponse(RoleBase):
    id: int
    est_systeme: bool
    date_creation: datetime
    permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True


class UserPermissionsUpdate(BaseModel):
    permission_ids: List[int]


class UserRoleUpdate(BaseModel):
    role_id: Optional[int] = None

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.permission import Permission, Role
from app.auth import get_current_user
from app.schemas.permissions import (
    PermissionCreate,
    PermissionResponse,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    UserPermissionsUpdate,
    UserRoleUpdate,
)

router = APIRouter(prefix="/api/permissions", tags=["Permissions & Roles"])


# ==================== Décorateur de vérification des permissions ====================


def require_permission(permission_code: str):
    """
    Décorateur pour vérifier qu'un utilisateur a une permission spécifique
    """

    def decorator(func):
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Utilisateur non authentifié",
                )

            if not current_user.has_permission(permission_code):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission requise: {permission_code}",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# ==================== Endpoints Permissions ====================


@router.get("/permissions", response_model=List[PermissionResponse])
def get_permissions(
    module: Optional[str] = None,
    actif: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Récupérer la liste des permissions
    Accessible aux admins uniquement
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )

    query = db.query(Permission)

    if module:
        query = query.filter(Permission.module == module)
    if actif is not None:
        query = query.filter(Permission.actif == actif)

    return query.order_by(Permission.module, Permission.action).all()


@router.post(
    "/permissions",
    response_model=PermissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_permission(
    permission: PermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Créer une nouvelle permission
    Accessible aux admins uniquement
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )

    # Vérifier que le code n'existe pas
    existing = db.query(Permission).filter(Permission.code == permission.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce code de permission existe déjà",
        )

    new_permission = Permission(**permission.dict())
    db.add(new_permission)
    db.commit()
    db.refresh(new_permission)

    return new_permission


@router.get("/modules")
def get_modules(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Récupérer la liste des modules avec leurs permissions
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )

    # Grouper les permissions par module
    permissions = db.query(Permission).filter(Permission.actif == True).all()

    modules = {}
    for perm in permissions:
        if perm.module not in modules:
            modules[perm.module] = {"module": perm.module, "permissions": []}
        modules[perm.module]["permissions"].append(
            {"id": perm.id, "code": perm.code, "nom": perm.nom, "action": perm.action}
        )

    return list(modules.values())


# ==================== Endpoints Rôles ====================


@router.get("/roles", response_model=List[RoleResponse])
def get_roles(
    actif: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Récupérer la liste des rôles
    """
    # print("Current user role:", current_user)  # Debug
    if current_user.role not in ["admin", "gestionnaire"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès non autorisé"
        )

    query = db.query(Role)

    if actif is not None:
        query = query.filter(Role.actif == actif)

    return query.order_by(Role.niveau.desc()).all()


@router.get("/roles/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Récupérer un rôle par son ID
    """
    if current_user.role not in ["admin", "gestionnaire"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès non autorisé"
        )

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rôle non trouvé"
        )

    return role


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Créer un nouveau rôle avec permissions
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )

    # Vérifier que le code n'existe pas
    existing = db.query(Role).filter(Role.code == role_data.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce code de rôle existe déjà",
        )

    # Créer le rôle
    new_role = Role(
        code=role_data.code,
        nom=role_data.nom,
        description=role_data.description,
        niveau=role_data.niveau,
        actif=role_data.actif,
        est_systeme=False,
    )

    # Ajouter les permissions
    if role_data.permission_ids:
        permissions = (
            db.query(Permission)
            .filter(Permission.id.in_(role_data.permission_ids))
            .all()
        )
        new_role.permissions = permissions

    db.add(new_role)
    db.commit()
    db.refresh(new_role)

    return new_role


@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Modifier un rôle
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rôle non trouvé"
        )

    # Ne pas modifier les rôles système
    if role.est_systeme:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les rôles système ne peuvent pas être modifiés",
        )

    # Mettre à jour les champs
    if role_data.nom is not None:
        role.nom = role_data.nom
    if role_data.description is not None:
        role.description = role_data.description
    if role_data.niveau is not None:
        role.niveau = role_data.niveau
    if role_data.actif is not None:
        role.actif = role_data.actif

    # Mettre à jour les permissions
    if role_data.permission_ids is not None:
        permissions = (
            db.query(Permission)
            .filter(Permission.id.in_(role_data.permission_ids))
            .all()
        )
        role.permissions = permissions

    db.commit()
    db.refresh(role)

    return role


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Supprimer un rôle
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Rôle non trouvé"
        )

    # Ne pas supprimer les rôles système
    if role.est_systeme:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les rôles système ne peuvent pas être supprimés",
        )

    # Vérifier qu'aucun utilisateur n'a ce rôle
    users_count = db.query(User).filter(User.role_id == role_id).count()
    if users_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer: {users_count} utilisateur(s) ont ce rôle",
        )

    db.delete(role)
    db.commit()

    return {"message": "Rôle supprimé avec succès"}


# ==================== Endpoints Attribution ====================


@router.put("/users/{user_id}/role")
def assign_user_role(
    user_id: int,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Attribuer un rôle à un utilisateur
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé"
        )

    # Vérifier que le rôle existe
    if role_data.role_id:
        role = db.query(Role).filter(Role.id == role_data.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Rôle non trouvé"
            )
        user.role_id = role_data.role_id
    else:
        user.role_id = None

    db.commit()

    return {
        "message": "Rôle attribué avec succès",
        "user_id": user_id,
        "role_id": user.role_id,
    }


@router.put("/users/{user_id}/permissions")
def assign_user_permissions(
    user_id: int,
    permissions_data: UserPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Attribuer des permissions spécifiques à un utilisateur
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé"
        )

    # Récupérer les permissions
    permissions = (
        db.query(Permission)
        .filter(Permission.id.in_(permissions_data.permission_ids))
        .all()
    )

    # Remplacer les permissions de l'utilisateur
    user.permissions = permissions

    db.commit()

    return {
        "message": "Permissions attribuées avec succès",
        "user_id": user_id,
        "permissions_count": len(permissions),
    }


@router.get("/users/{user_id}/permissions")
def get_user_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Récupérer toutes les permissions d'un utilisateur
    """
    # Seul l'admin ou l'utilisateur lui-même peut voir ses permissions
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Accès non autorisé"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé"
        )

    all_permissions = user.get_all_permissions()
    print(
        f"User {user.username} has permissions: {all_permissions} with permissions: {user.permissions}"
    )  # Debug

    return {
        "user_id": user_id,
        "role": user.role_obj.nom if user.role_obj else None,
        "permissions": all_permissions,
        "direct_permissions": [p.code for p in user.permissions],
        "role_permissions": (
            [p.code for p in user.role_obj.permissions] if user.role_obj else []
        ),
    }

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserStatusUpdate,
    UserResponse,
    Token,
    LoginRequest,
    ChangePasswordRequest,
)
from app.api.profile import log_activity
from app.auth import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    get_current_user,
    get_current_active_user,
    get_current_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.api.sessions import open_session  # <-- import the helper

router = APIRouter(prefix="/api/auth", tags=["Authentification"])


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_admin_user
    ),  # Seul un admin peut créer des comptes
):
    """
    Créer un nouveau compte utilisateur (Admin uniquement)
    """
    # Vérifier si l'email existe déjà
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cet email est déjà utilisé"
        )

    # Vérifier si le username existe déjà
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce nom d'utilisateur est déjà utilisé",
        )

    # Créer l'utilisateur
    user_dict = user_data.model_dump(exclude={"password"})
    user_dict["hashed_password"] = get_password_hash(user_data.password)

    new_user = User(**user_dict)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Se connecter et obtenir un token d'accès
    """
    user = authenticate_user(db, login_data.username, login_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Mettre à jour la dernière connexion
    user.last_login = datetime.utcnow()
    db.commit()

    # Créer le token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires,
    )

    session_id = open_session(db, user, request)  # <-- the one line to add

    # Logger l'activité
    log_activity(
        db,
        user.id,
        "login",
        "Connexion réussie",
        user.username,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "session_id": session_id,
    }


@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """
    Endpoint OAuth2 standard pour obtenir un token
    """
    user = authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Mettre à jour la dernière connexion
    user.last_login = datetime.utcnow()
    db.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    Récupérer les informations de l'utilisateur connecté
    """
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Mettre à jour les informations de l'utilisateur connecté
    """
    update_data = user_update.model_dump(
        exclude_unset=True, exclude={"role", "is_active"}
    )

    # Seul un admin peut modifier le rôle et le statut
    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    # Logger l'activité
    log_activity(
        db,
        current_user.id,
        "login",
        "Connexion réussie",
        current_user.username,
    )

    return current_user


@router.post("/change-password")
def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Changer le mot de passe de l'utilisateur connecté
    """
    from app.auth import verify_password

    # Vérifier l'ancien mot de passe
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ancien mot de passe incorrect",
        )

    # Mettre à jour le mot de passe
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    return {"message": "Mot de passe modifié avec succès"}


# Routes administrateur


@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Récupérer tous les utilisateurs (Admin uniquement)
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Récupérer un utilisateur par ID (Admin uniquement)
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable"
        )

    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Mettre à jour un utilisateur (Admin uniquement)
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable"
        )

    update_data = user_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@router.put("/users/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Mettre à jour le statut d'un utilisateur (Admin uniquement)
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable"
        )

    update_data = status_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """
    Supprimer un utilisateur (Admin uniquement)
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable"
        )

    db.delete(user)
    db.commit()

    return None


@router.post("/init-admin", response_model=UserResponse)
def initialize_admin(db: Session = Depends(get_db)):
    """
    Créer le premier compte administrateur (uniquement si aucun admin n'existe)
    """
    # Vérifier s'il existe déjà des utilisateurs
    if db.query(User).count() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Des utilisateurs existent déjà. Utilisez /register pour créer de nouveaux comptes.",
        )

    # Créer l'admin par défaut
    admin = User(
        email="admin@sigdp-gabon.ga",
        username="admin",
        hashed_password=get_password_hash("Admin@2025"),
        nom="Administrateur",
        prenom="Système",
        role="Administrateur",
        is_active=True,
        is_superuser=True,
    )

    db.add(admin)
    db.commit()
    db.refresh(admin)

    return admin

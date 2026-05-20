from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import json
import io
import os
import shutil
from PIL import Image

from app.database import get_db
from app.models.user import User
from app.auth import get_password_hash, verify_password, get_current_active_user

router = APIRouter(prefix="/api/auth/profile", tags=["User Profile"])


# Modèles Pydantic
class ProfileUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[EmailStr] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    ville: Optional[str] = None
    code_postal: Optional[str] = None
    pays: Optional[str] = None


class PasswordChange(BaseModel):
    ancien_password: str
    nouveau_password: str


class PreferencesUpdate(BaseModel):
    notifications: Optional[dict] = None
    theme: Optional[str] = None
    langue: Optional[str] = None


class ActivityLog(BaseModel):
    action: str
    description: str
    details: Optional[str] = None
    date: datetime = datetime.now()


# Endpoints


@router.get("")
def get_profile(current_user: User = Depends(get_current_active_user)):
    """
    Récupérer le profil de l'utilisateur connecté
    """
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "nom": current_user.nom,
        "prenom": current_user.prenom,
        "role": current_user.role,
        "actif": current_user.is_active,
        "date_creation": current_user.created_at,
        "telephone": getattr(current_user, "telephone", None),
        "adresse": getattr(current_user, "adresse", None),
        "ville": getattr(current_user, "ville", None),
        "code_postal": getattr(current_user, "code_postal", None),
        "pays": getattr(current_user, "pays", "Gabon"),
        "photo_profil": getattr(current_user, "photo_profil", None),
        "preferences": getattr(current_user, "preferences", {}),
    }


@router.put("")
def update_profile(
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Mettre à jour le profil de l'utilisateur
    """
    user = db.query(User).filter(User.id == current_user.id).first()

    if profile_data.nom is not None:
        user.nom = profile_data.nom

    if profile_data.prenom is not None:
        user.prenom = profile_data.prenom

    if profile_data.email is not None:
        # Vérifier si l'email existe déjà
        existing = (
            db.query(User)
            .filter(User.email == profile_data.email, User.id != current_user.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cet email est déjà utilisé",
            )
        user.email = profile_data.email

    # Mettre à jour les champs optionnels
    if profile_data.telephone is not None:
        user.telephone = profile_data.telephone
    if profile_data.adresse is not None:
        user.adresse = profile_data.adresse
    if profile_data.ville is not None:
        user.ville = profile_data.ville
    if profile_data.code_postal is not None:
        user.code_postal = profile_data.code_postal
    if profile_data.pays is not None:
        user.pays = profile_data.pays

    # Logger l'activité
    log_activity(
        db, user.id, "update", "Modification du profil", "Informations personnelles"
    )

    db.commit()
    db.refresh(user)

    return {
        "message": "Profil mis à jour avec succès",
        "user": get_profile(current_user=user),
    }


@router.post("/change-password")
def change_password(
    password_data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Changer le mot de passe de l'utilisateur
    """
    # Vérifier l'ancien mot de passe
    if not verify_password(password_data.ancien_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ancien mot de passe incorrect",
        )

    # Vérifier que le nouveau mot de passe est différent
    if verify_password(password_data.nouveau_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit être différent de l'ancien",
        )

    # Mettre à jour le mot de passe
    user = db.query(User).filter(User.id == current_user.id).first()
    user.hashed_password = get_password_hash(password_data.nouveau_password)

    # Logger l'activité
    log_activity(db, user.id, "update", "Changement de mot de passe", "Sécurité")

    db.commit()

    return {"message": "Mot de passe modifié avec succès"}


@router.post("/upload-photo")
async def upload_profile_photo(
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Uploader une photo de profil
    """
    # Vérifier le type de fichier
    if not photo.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier doit être une image",
        )

    # Créer le dossier s'il n'existe pas
    upload_dir = "uploads/profiles"
    os.makedirs(upload_dir, exist_ok=True)

    # Nom du fichier
    file_extension = photo.filename.split(".")[-1]
    filename = f"user_{current_user.id}_{datetime.now().timestamp()}.{file_extension}"
    file_path = os.path.join(upload_dir, filename)

    # Sauvegarder le fichier
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)

    # Redimensionner l'image
    try:
        img = Image.open(file_path)
        img.thumbnail((300, 300))
        img.save(file_path)
    except Exception as e:
        print(f"Erreur redimensionnement: {e}")

    # Supprimer l'ancienne photo si elle existe
    user = db.query(User).filter(User.id == current_user.id).first()
    if user.photo_profil and os.path.exists(user.photo_profil):
        try:
            os.remove(user.photo_profil)
        except:
            pass

    # Mettre à jour le profil
    user.photo_profil = file_path

    # Logger l'activité
    log_activity(db, user.id, "update", "Upload photo de profil", "Photo mise à jour")

    db.commit()

    return {
        "message": "Photo de profil mise à jour",
        "photo_url": f"/api/uploads/profiles/{filename}",
    }


@router.put("/preferences")
def update_preferences(
    preferences: PreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Mettre à jour les préférences utilisateur
    """
    user = db.query(User).filter(User.id == current_user.id).first()

    # Charger les préférences existantes
    current_prefs = user.preferences or {}

    # Mettre à jour les préférences
    if preferences.notifications is not None:
        current_prefs["notifications"] = preferences.notifications
    if preferences.theme is not None:
        current_prefs["theme"] = preferences.theme
    if preferences.langue is not None:
        current_prefs["langue"] = preferences.langue

    user.preferences = current_prefs

    # Logger l'activité
    log_activity(
        db, user.id, "update", "Modification des préférences", "Notifications et thème"
    )

    db.commit()

    return {"message": "Préférences mises à jour", "preferences": current_prefs}


@router.get("/stats")
def get_user_stats(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    """
    Récupérer les statistiques de l'utilisateur
    """
    # Compter les activités
    from app.models.activity_log import ActivityLog

    nb_connexions = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id, ActivityLog.action == "login")
        .count()
    )

    nb_modifications = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id, ActivityLog.action == "update")
        .count()
    )

    nb_exports = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id, ActivityLog.action == "export")
        .count()
    )

    # Dernière connexion
    last_login = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id, ActivityLog.action == "login")
        .order_by(ActivityLog.date.desc())
        .first()
    )

    return {
        "nb_connexions": nb_connexions,
        "nb_modifications": nb_modifications,
        "nb_exports": nb_exports,
        "derniere_connexion": last_login.date if last_login else None,
    }


@router.get("/activity")
def get_activity_log(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Récupérer l'historique d'activité de l'utilisateur
    """
    from app.models.activity_log import ActivityLog

    activities = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.date.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "action": a.action,
            "description": a.description,
            "details": a.details,
            "date": a.date,
        }
        for a in activities
    ]


@router.get("/export")
def export_user_data(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    """
    Exporter toutes les données de l'utilisateur (RGPD)
    """
    from app.models.activity_log import ActivityLog

    # Données personnelles
    user_data = {
        "informations_personnelles": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "nom": current_user.nom,
            "prenom": current_user.prenom,
            "role": current_user.role,
            "date_creation": current_user.created_at.isoformat(),
            "telephone": getattr(current_user, "telephone", None),
            "adresse": getattr(current_user, "adresse", None),
            "ville": getattr(current_user, "ville", None),
            "code_postal": getattr(current_user, "code_postal", None),
            "pays": getattr(current_user, "pays", None),
        },
        "preferences": getattr(current_user, "preferences", {}),
        "historique_activite": [],
    }

    # Historique d'activité
    activities = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == current_user.id)
        .order_by(ActivityLog.date.desc())
        .all()
    )

    user_data["historique_activite"] = [
        {
            "action": a.action,
            "description": a.description,
            "details": a.details,
            "date": a.date.isoformat(),
        }
        for a in activities
    ]

    # Créer le fichier JSON
    json_data = json.dumps(user_data, indent=2, ensure_ascii=False)

    # Logger l'activité
    log_activity(
        db, current_user.id, "export", "Export des données personnelles", "Export RGPD"
    )

    return StreamingResponse(
        io.BytesIO(json_data.encode("utf-8")),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=donnees_utilisateur_{current_user.id}.json"
        },
    )


@router.delete("")
def delete_account(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
):
    """
    Supprimer le compte utilisateur (RGPD - droit à l'oubli)
    """
    # Ne pas autoriser la suppression du dernier admin
    if current_user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de supprimer le dernier administrateur",
            )

    # Supprimer la photo de profil
    if current_user.photo_profil and os.path.exists(current_user.photo_profil):
        try:
            os.remove(current_user.photo_profil)
        except:
            pass

    # Supprimer l'utilisateur
    db.delete(current_user)
    db.commit()

    return {"message": "Compte supprimé avec succès"}


# Fonction utilitaire pour logger les activités
def log_activity(
    db: Session, user_id: int, action: str, description: str, details: str = None
):
    """
    Enregistrer une activité utilisateur
    """
    try:
        from app.models.activity_log import ActivityLog

        activity = ActivityLog(
            user_id=user_id,
            action=action,
            description=description,
            details=details,
            date=datetime.now(),
        )

        db.add(activity)
        db.commit()
    except Exception as e:
        print(f"Erreur log activité: {e}")

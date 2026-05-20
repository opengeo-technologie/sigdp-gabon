# app/services/activity_logger.py

from sqlalchemy.orm import Session
from fastapi import Request
from typing import Optional
from datetime import datetime

from app.models.activity_log import ActivityLog
from app.models.user import User


class ActivityLogger:
    """
    Service centralisé pour logger toutes les activités utilisateurs
    """

    # Constantes pour les actions
    LOGIN = "login"
    LOGOUT = "logout"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    EXPORT = "export"
    VALIDATE = "validate"
    SUSPEND = "suspend"
    REVOKE = "revoke"
    INSPECT = "inspect"
    VIOLATION = "violation"
    VIEW = "view"
    SEARCH = "search"
    DOWNLOAD = "download"

    # Constantes pour les modules
    MODULE_PECHEUR = "pecheur"
    MODULE_BATEAU = "bateau"
    MODULE_DEBARQUEMENT = "debarquement"
    MODULE_ESPECE = "espece"
    MODULE_DEBARCADERE = "debarcadere"
    MODULE_LICENCE = "licence"
    MODULE_USER = "utilisateur"
    MODULE_SYSTEM = "systeme"
    MODULE_RAPPORT = "rapport"
    MODULE_STATISTIQUE = "statistique"

    @staticmethod
    def log(
        db: Session,
        user_id: int,
        action: str,
        description: str,
        module: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        details: Optional[str] = None,
        request: Optional[Request] = None,
        status: str = "success",
        error_message: Optional[str] = None,
    ) -> ActivityLog:
        """
        Créer un log d'activité

        Args:
            db: Session de base de données
            user_id: ID de l'utilisateur
            action: Type d'action (login, create, update, etc.)
            description: Description courte de l'action
            module: Module concerné (optionnel)
            entity_type: Type d'entité (optionnel)
            entity_id: ID de l'entité (optionnel)
            details: Détails JSON (optionnel)
            request: Request FastAPI pour extraire IP et user-agent (optionnel)
            status: Statut de l'action (success, failure, error)
            error_message: Message d'erreur si échec (optionnel)

        Returns:
            ActivityLog créé
        """
        # Extraire IP et user-agent de la requête
        ip_address = None
        user_agent = None

        if request:
            # IP address
            ip_address = request.client.host if request.client else None

            # User agent
            user_agent = request.headers.get("user-agent")
            if user_agent and len(user_agent) > 255:
                user_agent = user_agent[:255]

        # Créer le log
        log = ActivityLog(
            user_id=user_id,
            action=action,
            description=description,
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            error_message=error_message,
        )

        db.add(log)
        db.commit()
        db.refresh(log)

        return log

    @staticmethod
    def log_login(
        db: Session,
        user_id: int,
        request: Optional[Request] = None,
        success: bool = True,
    ):
        """Logger une connexion"""
        description = "Connexion réussie" if success else "Échec de connexion"
        status = "success" if success else "failure"

        return ActivityLogger.log(
            db=db,
            user_id=user_id,
            action=ActivityLogger.LOGIN,
            description=description,
            module=ActivityLogger.MODULE_SYSTEM,
            request=request,
            status=status,
        )

    @staticmethod
    def log_logout(db: Session, user_id: int, request: Optional[Request] = None):
        """Logger une déconnexion"""
        return ActivityLogger.log(
            db=db,
            user_id=user_id,
            action=ActivityLogger.LOGOUT,
            description="Déconnexion",
            module=ActivityLogger.MODULE_SYSTEM,
            request=request,
        )

    @staticmethod
    def log_create(
        db: Session,
        user_id: int,
        module: str,
        entity_type: str,
        entity_id: int,
        entity_name: str,
        request: Optional[Request] = None,
        details: Optional[str] = None,
    ):
        """Logger une création"""
        return ActivityLogger.log(
            db=db,
            user_id=user_id,
            action=ActivityLogger.CREATE,
            description=f"Création {entity_type}: {entity_name}",
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            request=request,
        )

    @staticmethod
    def log_update(
        db: Session,
        user_id: int,
        module: str,
        entity_type: str,
        entity_id: int,
        entity_name: str,
        request: Optional[Request] = None,
        details: Optional[str] = None,
    ):
        """Logger une mise à jour"""
        return ActivityLogger.log(
            db=db,
            user_id=user_id,
            action=ActivityLogger.UPDATE,
            description=f"Modification {entity_type}: {entity_name}",
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            request=request,
        )

    @staticmethod
    def log_delete(
        db: Session,
        user_id: int,
        module: str,
        entity_type: str,
        entity_id: int,
        entity_name: str,
        request: Optional[Request] = None,
    ):
        """Logger une suppression"""
        return ActivityLogger.log(
            db=db,
            user_id=user_id,
            action=ActivityLogger.DELETE,
            description=f"Suppression {entity_type}: {entity_name}",
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            request=request,
        )

    @staticmethod
    def log_export(
        db: Session,
        user_id: int,
        module: str,
        format: str,
        filters: Optional[str] = None,
        request: Optional[Request] = None,
    ):
        """Logger un export"""
        description = f"Export {module} ({format})"
        return ActivityLogger.log(
            db=db,
            user_id=user_id,
            action=ActivityLogger.EXPORT,
            description=description,
            module=module,
            details=filters,
            request=request,
        )

    @staticmethod
    def log_validate(
        db: Session,
        user_id: int,
        module: str,
        entity_type: str,
        entity_id: int,
        entity_name: str,
        request: Optional[Request] = None,
    ):
        """Logger une validation"""
        return ActivityLogger.log(
            db=db,
            user_id=user_id,
            action=ActivityLogger.VALIDATE,
            description=f"Validation {entity_type}: {entity_name}",
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            request=request,
        )

    @staticmethod
    def log_error(
        db: Session,
        user_id: int,
        action: str,
        description: str,
        error_message: str,
        module: Optional[str] = None,
        request: Optional[Request] = None,
    ):
        """Logger une erreur"""
        return ActivityLogger.log(
            db=db,
            user_id=user_id,
            action=action,
            description=description,
            module=module,
            request=request,
            status="error",
            error_message=error_message,
        )


# Décorateur pour logger automatiquement les actions
from functools import wraps
from fastapi import HTTPException


def log_activity(action: str, module: str, get_description: callable = None):
    """
    Décorateur pour logger automatiquement les actions

    Usage:
        @log_activity(action="create", module="pecheur")
        def create_pecheur(...):
            ...
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Récupérer db et current_user depuis kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            request = kwargs.get("request")

            if not db or not current_user:
                # Si pas d'accès à db ou user, exécuter normalement
                return await func(*args, **kwargs)

            try:
                # Exécuter la fonction
                result = await func(*args, **kwargs)

                # Logger le succès
                description = (
                    get_description(result) if get_description else f"Action {action}"
                )

                ActivityLogger.log(
                    db=db,
                    user_id=current_user.id,
                    action=action,
                    description=description,
                    module=module,
                    request=request,
                    status="success",
                )

                return result

            except HTTPException as e:
                # Logger l'échec HTTP
                ActivityLogger.log(
                    db=db,
                    user_id=current_user.id,
                    action=action,
                    description=f"Échec {action}",
                    module=module,
                    request=request,
                    status="failure",
                    error_message=str(e.detail),
                )
                raise

            except Exception as e:
                # Logger l'erreur
                ActivityLogger.log(
                    db=db,
                    user_id=current_user.id,
                    action=action,
                    description=f"Erreur {action}",
                    module=module,
                    request=request,
                    status="error",
                    error_message=str(e),
                )
                raise

        return wrapper

    return decorator

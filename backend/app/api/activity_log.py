# app/api/activity_logs.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas.activity_log import (
    ActivityLogResponse,
    ActivityLogFilter,
    ActivityStats,
)
from app.auth import get_current_user, get_current_admin_user

# from app.core.auth import get_current_user
# from app.core.permissions import PermissionChecker

router = APIRouter(prefix="/api/activity-logs", tags=["Activity Logs"])


@router.get("", response_model=List[ActivityLogResponse])
def get_activity_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    module: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Récupérer l'historique des activités avec filtres
    Nécessite: systeme.audit
    """
    query = db.query(ActivityLog).join(User)

    # Appliquer les filtres
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)

    if action:
        query = query.filter(ActivityLog.action == action)

    if module:
        query = query.filter(ActivityLog.module == module)

    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)

    if entity_id:
        query = query.filter(ActivityLog.entity_id == entity_id)

    if status:
        query = query.filter(ActivityLog.status == status)

    if date_from:
        query = query.filter(ActivityLog.created_at >= date_from)

    if date_to:
        query = query.filter(ActivityLog.created_at <= date_to)

    if search:
        query = query.filter(ActivityLog.description.ilike(f"%{search}%"))

    # Ordonner par date décroissante
    query = query.order_by(desc(ActivityLog.created_at))

    # Pagination
    logs = query.offset(skip).limit(limit).all()

    # Enrichir avec infos utilisateur
    results = []
    for log in logs:
        log_dict = ActivityLogResponse.from_orm(log).model_dump()
        log_dict["username"] = log.user.username
        log_dict["user_email"] = log.user.email
        results.append(ActivityLogResponse(**log_dict))

    return results


@router.get("/stats", response_model=ActivityStats)
def get_activity_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Statistiques d'activité
    Nécessite: systeme.audit
    """
    # Date de début
    date_from = datetime.now() - timedelta(days=days)

    # Total actions
    total_actions = (
        db.query(ActivityLog).filter(ActivityLog.created_at >= date_from).count()
    )

    # Actions par type
    actions_by_type = {}
    action_counts = (
        db.query(ActivityLog.action, func.count(ActivityLog.id))
        .filter(ActivityLog.created_at >= date_from)
        .group_by(ActivityLog.action)
        .all()
    )

    for action, count in action_counts:
        actions_by_type[action] = count

    # Actions par module
    actions_by_module = {}
    module_counts = (
        db.query(ActivityLog.module, func.count(ActivityLog.id))
        .filter(ActivityLog.created_at >= date_from, ActivityLog.module.isnot(None))
        .group_by(ActivityLog.module)
        .all()
    )

    for module, count in module_counts:
        actions_by_module[module] = count

    # Actions par utilisateur
    actions_by_user = {}
    user_counts = (
        db.query(ActivityLog.user_id, func.count(ActivityLog.id))
        .filter(ActivityLog.created_at >= date_from)
        .group_by(ActivityLog.user_id)
        .all()
    )

    for user_id, count in user_counts:
        actions_by_user[user_id] = count

    # Actions par statut
    actions_by_status = {}
    status_counts = (
        db.query(ActivityLog.status, func.count(ActivityLog.id))
        .filter(ActivityLog.created_at >= date_from)
        .group_by(ActivityLog.status)
        .all()
    )

    for status, count in status_counts:
        actions_by_status[status] = count

    # Utilisateurs les plus actifs (top 10)
    most_active_users = (
        db.query(ActivityLog.user_id, func.count(ActivityLog.id).label("count"))
        .filter(ActivityLog.created_at >= date_from)
        .group_by(ActivityLog.user_id)
        .order_by(desc("count"))
        .limit(10)
        .all()
    )

    # Activités récentes (10 dernières)
    recent_activities = (
        db.query(ActivityLog)
        .join(User)
        .order_by(desc(ActivityLog.created_at))
        .limit(10)
        .all()
    )

    recent_list = []
    for log in recent_activities:
        log_dict = ActivityLogResponse.from_orm(log).model_dump()
        log_dict["username"] = log.user.username
        recent_list.append(log_dict)

    return ActivityStats(
        total_actions=total_actions,
        actions_by_type=actions_by_type,
        actions_by_module=actions_by_module,
        actions_by_user=actions_by_user,
        actions_by_status=actions_by_status,
        most_active_users=[(user_id, count) for user_id, count in most_active_users],
        recent_activities=recent_list,
    )


@router.get("/user/{user_id}", response_model=List[ActivityLogResponse])
def get_user_activities(
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Récupérer l'historique d'un utilisateur spécifique
    Admin ou l'utilisateur lui-même peut consulter
    """
    # Vérifier permissions
    if current_user.id != user_id:
        # Si ce n'est pas son propre historique, vérifier permission admin
        if not current_user.has_permission("systeme.audit"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Permission refusée"
            )

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user_id)
        .order_by(desc(ActivityLog.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for log in logs:
        log_dict = ActivityLogResponse.from_orm(log).model_dump()
        log_dict["username"] = current_user.username
        log_dict["user_email"] = current_user.email
        results.append(ActivityLogResponse(**log_dict))

    return results


@router.get(
    "/entity/{entity_type}/{entity_id}", response_model=List[ActivityLogResponse]
)
def get_entity_history(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Récupérer l'historique d'une entité spécifique
    Ex: /api/activity-logs/entity/Pecheur/123
    """
    logs = (
        db.query(ActivityLog)
        .join(User)
        .filter(
            ActivityLog.entity_type == entity_type, ActivityLog.entity_id == entity_id
        )
        .order_by(desc(ActivityLog.created_at))
        .all()
    )

    results = []
    for log in logs:
        log_dict = ActivityLogResponse.from_orm(log).model_dump()
        log_dict["username"] = log.user.username
        log_dict["user_email"] = log.user.email
        results.append(ActivityLogResponse(**log_dict))

    return results


@router.delete("/cleanup")
def cleanup_old_logs(
    days: int = Query(90, ge=30, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Nettoyer les logs de plus de X jours
    Nécessite: systeme.settings (admin)
    """
    date_threshold = datetime.now() - timedelta(days=days)

    deleted_count = (
        db.query(ActivityLog).filter(ActivityLog.created_at < date_threshold).delete()
    )

    db.commit()

    return {
        "message": f"{deleted_count} logs supprimés",
        "threshold_date": date_threshold,
    }

# app/api/sessions.py
import threading
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal  # adjust import to your project
from app.models.user_session import UserSession

router = APIRouter(prefix="/api/sessions", tags=["Presence"])

# --------------------------------------------------------------------------
# Safety net for a logout beacon that never arrives (crash, force-quit, dead
# network). A session whose last heartbeat is older than this is treated as
# gone. Active users never hit it — their 30s heartbeat keeps them alive.
# Set to None to make presence end ONLY on explicit logout / tab-close beacon.
# --------------------------------------------------------------------------
SAFETY_WINDOW: timedelta | None = timedelta(minutes=5)

# Live presence only. The durable record is the DB row.
# session_id -> {user_id, username, role, ip_address, login_at, last_seen_at}
_live: dict[str, dict] = {}
_lock = threading.Lock()


# ==========================================================================
# Called from your /login handler, once, after credentials are verified.
# Returns the session_id the frontend stores as sigpa_session_id.
# ==========================================================================
def open_session(db: Session, user, request: Request) -> str:
    # user.role may be an Enum (e.g. UserRole.ADMIN) -> store its value
    raw_role = getattr(user, "role", None)
    role = (
        raw_role.value
        if hasattr(raw_role, "value")
        else (str(raw_role) if raw_role is not None else None)
    )

    row = UserSession(
        user_id=user.id,
        username=user.username,
        role=role,
        ip_address=request.client.host if request.client else None,
    )
    db.add(row)
    db.commit()  # the single write, once the user is connected
    db.refresh(row)

    now = datetime.now(timezone.utc)
    with _lock:
        _live[str(row.id)] = {
            "user_id": row.user_id,
            "username": row.username,
            "role": role,
            "ip_address": str(row.ip_address) if row.ip_address else None,
            "login_at": row.login_at,
            "last_seen_at": now,
        }
    return str(row.id)


def _close(db: Session, session_id: str) -> None:
    """Close the DB row and drop live presence. Idempotent; safe on bad ids."""
    with _lock:
        _live.pop(session_id, None)
    try:
        sid = UUID(session_id)
    except ValueError:
        return
    db.execute(
        update(UserSession)
        .where(UserSession.id == sid, UserSession.is_active.is_(True))
        .values(is_active=False, logout_at=datetime.now(timezone.utc))
    )
    db.commit()


@router.post("/heartbeat/{session_id}")
def heartbeat(session_id: str):
    """Frontend pings every 30s. In-memory only — no DB write."""
    with _lock:
        s = _live.get(session_id)
        if s:
            s["last_seen_at"] = datetime.now(timezone.utc)
    return {"ok": True}


@router.post("/logout/{session_id}")
def logout(session_id: str, db: Session = Depends(get_db)):
    """Hit by the explicit logout button AND the tab-close sendBeacon."""
    _close(db, session_id)
    return {"ok": True}


@router.post("/reconnect/{session_id}")
def reconnect(session_id: str, db: Session = Depends(get_db)):
    """Hit by the explicit logout button AND the tab-close sendBeacon."""
    db.execute(
        update(UserSession)
        .where(UserSession.id == session_id, UserSession.is_active.is_(False))
        .values(is_active=True, logout_at=datetime.now(timezone.utc))
    )
    db.commit()

    return {"ok": True}


@router.get("/connected")
def connected_users(db: Session = Depends(get_db)):
    """All currently-connected users with time-lasted (duration_seconds)."""
    now = datetime.now(timezone.utc)

    # SAFETY_WINDOW = None

    with _lock:
        if SAFETY_WINDOW is not None:
            cutoff = now - SAFETY_WINDOW
            stale = [sid for sid, s in _live.items() if s["last_seen_at"] < cutoff]
        else:
            stale = []
        live = sorted(
            ((sid, s) for sid, s in _live.items() if sid not in stale),
            key=lambda kv: kv[1]["login_at"],
        )

    for sid in stale:  # close any orphaned rows the beacon missed
        _close(db, sid)

    return [
        {
            "session_id": sid,
            "user_id": s["user_id"],
            "username": s["username"],
            "role": s["role"],
            "ip_address": s["ip_address"],
            "login_at": s["login_at"].isoformat(),
            "duration_seconds": int((now - s["login_at"]).total_seconds()),
        }
        for sid, s in live
    ]


def close_orphan_sessions() -> None:
    """Run on startup: close rows a previous run left active (crash/restart)."""
    db = SessionLocal()
    try:
        db.execute(
            update(UserSession)
            .where(UserSession.is_active.is_(True))
            .values(is_active=False, logout_at=datetime.now(timezone.utc))
        )
        db.commit()
    finally:
        db.close()

# routers/presence.py
from fastapi import APIRouter, Depends
from app.classes.presence import presence
from app.auth import get_current_user  # your existing JWT dependency

router = APIRouter(prefix="/api/presence", tags=["presence"])


@router.post("/ping")
def ping(active: bool = True, user=Depends(get_current_user)):
    presence.ping(user, active=active)
    return {"ok": True}


@router.post("/disconnect")
def disconnect(user=Depends(get_current_user)):
    presence.disconnect(user.id)
    return {"ok": True}


@router.get("/online")
def online(_=Depends(get_current_user)):
    return presence.online_users()

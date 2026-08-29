# presence.py
import time
from dataclasses import dataclass
from threading import Lock

HEARTBEAT_INTERVAL = 15  # frontend pings this often (s)
ONLINE_THRESHOLD = 35  # no ping for this long => dropped as offline
IDLE_THRESHOLD = 300  # no interaction for this long => "idle" but still connected


@dataclass
class Session:
    user_id: int
    username: str
    full_name: str
    role: str
    connected_at: float
    last_seen: float
    last_activity: float


class PresenceManager:
    def __init__(self):
        self._sessions: dict[int, Session] = {}
        self._lock = Lock()

    def ping(self, user: dict, active: bool = True) -> None:
        now = time.time()
        # print(user)
        with self._lock:
            s = self._sessions.get(user.id)
            # new connection, or reconnecting after being offline -> reset connected_at
            if s is None or (now - s.last_seen) > ONLINE_THRESHOLD:
                self._sessions[user.id] = Session(
                    user_id=user.id,
                    username=user.username,
                    full_name=getattr(user, "full_name", None) or user.username,
                    role=getattr(user, "role", "") or "",
                    connected_at=now,
                    last_seen=now,
                    last_activity=now,
                )
            else:
                s.last_seen = now
                if active:
                    s.last_activity = now

    def disconnect(self, user_id: int) -> None:
        with self._lock:
            self._sessions.pop(user_id, None)

    def online_users(self) -> list[dict]:
        now = time.time()
        with self._lock:
            for uid in [
                u
                for u, s in self._sessions.items()
                if now - s.last_seen > ONLINE_THRESHOLD
            ]:
                del self._sessions[uid]  # prune stale
            out = [
                {
                    "user_id": s.user_id,
                    "username": s.username,
                    "full_name": s.full_name,
                    "role": s.role,
                    "status": (
                        "idle" if (now - s.last_activity) > IDLE_THRESHOLD else "online"
                    ),
                    "connected_at": s.connected_at,
                    "duration_seconds": int(now - s.connected_at),
                    "last_seen_seconds": int(now - s.last_seen),
                }
                for s in self._sessions.values()
            ]
        out.sort(key=lambda u: u["connected_at"])
        return out


presence = PresenceManager()

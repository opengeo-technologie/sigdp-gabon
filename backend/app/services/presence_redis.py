# presence_redis.py
import json, time, redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)
KEY, ONLINE_THRESHOLD, IDLE_THRESHOLD = "presence:{}", 35, 300


def ping(user: dict, active: bool = True) -> None:
    now, key = time.time(), KEY.format(user["id"])
    prev = r.get(key)
    connected_at = json.loads(prev)["connected_at"] if prev else now
    last_activity = now if active or not prev else json.loads(prev)["last_activity"]
    r.set(
        key,
        json.dumps(
            {
                "user_id": user["id"],
                "username": user["username"],
                "full_name": user.get("full_name", user["username"]),
                "role": user.get("role", ""),
                "connected_at": connected_at,
                "last_seen": now,
                "last_activity": last_activity,
            }
        ),
        ex=ONLINE_THRESHOLD,
    )


def disconnect(user_id: int) -> None:
    r.delete(KEY.format(user_id))


def online_users() -> list[dict]:
    now, out = time.time(), []
    for key in r.scan_iter(match="presence:*"):
        raw = r.get(key)
        if not raw:
            continue
        d = json.loads(raw)
        out.append(
            {
                **d,
                "status": (
                    "idle" if (now - d["last_activity"]) > IDLE_THRESHOLD else "online"
                ),
                "duration_seconds": int(now - d["connected_at"]),
                "last_seen_seconds": int(now - d["last_seen"]),
            }
        )
    out.sort(key=lambda u: u["connected_at"])
    return out

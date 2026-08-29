# models.py
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, String, Boolean, Integer, DateTime, func, Column
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class UserSession(Base):
    __tablename__ = "user_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    username = Column(String(150), nullable=False)
    role = Column(String(50), nullable=True)
    ip_address = Column(INET, nullable=True)
    login_at = Column(DateTime(timezone=True), server_default=func.now())
    logout_at = Column(DateTime(timezone=True), nullable=True)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

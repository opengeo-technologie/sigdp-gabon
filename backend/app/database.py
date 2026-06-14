from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from geoalchemy2 import Geometry
from app.config import settings
from sqlalchemy.pool import QueuePool

engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    # echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    connect_args={"connect_timeout": 10},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=True, bind=engine)

Base = declarative_base()


def get_db():
    """
    Dependency for database sessions
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

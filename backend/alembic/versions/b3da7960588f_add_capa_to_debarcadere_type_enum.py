"""add CAPA to debarcadere type enum

Revision ID: b3da7960588f
Revises:
Create Date: 2026-07-05 00:46:52.373101

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b3da7960588f"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TYPE debarcaderetype
        ADD VALUE IF NOT EXISTS 'Centre d''Appui à la Pêche Artisanale';
    """)


def downgrade() -> None:
    pass

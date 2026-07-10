"""add_capa_to_debarcaderetype

Revision ID: 3d5b717a946b
Revises: 9b6bf835a4fe
Create Date: 2026-07-05 08:12:03.767190

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "3d5b717a946b"
down_revision: Union[str, None] = "9b6bf835a4fe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF NOT EXISTS évite l'erreur si la valeur est déjà présente
    op.execute("ALTER TYPE debarcaderetype ADD VALUE IF NOT EXISTS 'CAPA'")


def downgrade() -> None:
    # PostgreSQL ne supporte pas DROP VALUE — recréation complète du type
    op.execute("UPDATE debarcaderes SET type = 'OFFICIEL' WHERE type = 'CAPA'")
    op.execute("ALTER TYPE debarcaderetype RENAME TO debarcaderetype_old")
    op.execute(
        "CREATE TYPE debarcaderetype AS ENUM ('OFFICIEL', 'INFORMEL', 'SAISONNIER')"
    )
    op.execute("""ALTER TABLE debarcaderes
           ALTER COLUMN type
           TYPE debarcaderetype
           USING type::text::debarcaderetype""")
    op.execute("DROP TYPE debarcaderetype_old")

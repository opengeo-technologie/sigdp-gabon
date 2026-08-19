"""update categorie especes values

Revision ID: 33de048233ea
Revises: 64ec962942c2
Create Date: 2026-08-09 07:46:09.282454

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "33de048233ea"
down_revision: Union[str, None] = "64ec962942c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute("""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'categorieespece' AND e.enumlabel = 'EAU_DOUCE'
          ) THEN
            ALTER TYPE categorieespece RENAME VALUE 'EAU_DOUCE' TO 'EAU DOUCE';
          END IF;
        END$$;
    """)


def downgrade():
    op.execute("""
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'categorieespece' AND e.enumlabel = 'EAU DOUCE'
          ) THEN
            ALTER TYPE categorieespece RENAME VALUE 'EAU DOUCE' TO 'EAU_DOUCE';
          END IF;
        END$$;
    """)

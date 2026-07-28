"""update site_id pecheur_id pirogue_id transaction mareyeur

Revision ID: e42bb1ff2b1d
Revises: 2ed5f5e0cdce
Create Date: 2026-07-21 15:43:13.334182

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e42bb1ff2b1d"
down_revision: Union[str, None] = "2ed5f5e0cdce"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions_achat_mareyage",
        sa.Column("pirogue_id", sa.Integer, nullable=True),
    )
    op.add_column(
        "transactions_achat_mareyage",
        sa.Column("site_debarquement_id", sa.Integer, nullable=True),
    )
    op.add_column(
        "transactions_achat_mareyage",
        sa.Column("pecheur_id", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    pass

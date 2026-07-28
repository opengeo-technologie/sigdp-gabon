"""update etat transaction mareyeur

Revision ID: 2ed5f5e0cdce
Revises: 3d5b717a946b
Create Date: 2026-07-21 10:39:32.634555

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2ed5f5e0cdce"
down_revision: Union[str, None] = "3d5b717a946b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions_achat_mareyage",
        sa.Column(
            "etat_poisson", sa.String(20), nullable=False, server_default="frais"
        ),
    )
    op.create_index(
        "ix_transactions_achat_mareyage_etat_poisson",
        "transactions_achat_mareyage",
        ["etat_poisson"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_transactions_achat_mareyage_etat_poisson",
        table_name="transactions_achat_mareyage",
    )
    op.drop_column("transactions_achat_mareyage", "etat_poisson")

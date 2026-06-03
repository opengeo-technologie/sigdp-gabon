"""initial

Revision ID: af765b1be6ac
Revises:
Create Date: 2026-06-01 09:29:53.981285

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "af765b1be6ac"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bateaux", sa.Column("site_port_attache", sa.String(), nullable=True))
    op.add_column("bateaux", sa.Column("regime", sa.String(), nullable=True))
    op.add_column("bateaux", sa.Column("pavillon", sa.String(), nullable=True))
    op.add_column("bateaux", sa.Column("statut_bateau", sa.String(), nullable=True))
    op.add_column("bateaux", sa.Column("balise_vms_imei", sa.String(), nullable=True))
    op.add_column("bateaux", sa.Column("balise_vms_actif", sa.Boolean(), nullable=True))
    op.add_column("bateaux", sa.Column("balise_ais_imei", sa.String(), nullable=True))
    op.add_column("bateaux", sa.Column("balise_ais_actif", sa.Boolean(), nullable=True))
    op.add_column("bateaux", sa.Column("balise_immo_imei", sa.String(), nullable=True))
    op.add_column(
        "bateaux", sa.Column("balise_immo_actif", sa.Boolean(), nullable=True)
    )
    op.add_column("bateaux", sa.Column("code_vhf", sa.String(), nullable=True))


def downgrade() -> None:
    pass

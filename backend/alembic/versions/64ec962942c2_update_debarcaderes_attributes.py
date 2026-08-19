"""update debarcaderes attributes

Revision ID: 64ec962942c2
Revises: 48adee70b0f1
Create Date: 2026-08-05 08:36:37.110935

"""

from collections import Counter, defaultdict
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "64ec962942c2"
down_revision: Union[str, None] = "48adee70b0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill(bind):
    debs = (
        bind.execute(sa.text("SELECT id, province, localite FROM debarcaderes"))
        .mappings()
        .all()
    )
    if not debs:
        return

    # 1) Attacher strate majeure sur province
    strate_maj_id = None
    strate_mineure_id = None
    for deb in debs:
        row = bind.execute(
            sa.text("SELECT id FROM strates_majeures WHERE libelle = :lib"),
            {"lib": deb["province"]},
        ).first()
        if row:
            strate_maj_id = row[0]
        else:
            strate_maj_id = bind.execute(
                sa.text(
                    "INSERT INTO strates_majeures "
                    "(libelle, created_at) "
                    "VALUES (:lib, now()) RETURNING id"
                ),
                {"lib": deb["province"]},
            ).scalar()

        row = bind.execute(
            sa.text("SELECT id FROM strates_mineures WHERE libelle = :lib"),
            {"lib": deb["localite"]},
        ).first()
        if row:
            strate_mineure_id = row[0]
        else:
            strate_mineure_id = bind.execute(
                sa.text(
                    "INSERT INTO strates_mineures "
                    "(libelle, strate_majeure_id, created_at) "
                    "VALUES (:lib, :mid, now()) RETURNING id"
                ),
                {"lib": deb["localite"], "mid": strate_maj_id},
            ).scalar()

        bind.execute(
            sa.text(
                "UPDATE debarcaderes SET strate_majeure_id = :mid, strate_mineure_id = :mino  WHERE province = :prov AND localite = :loc"
            ),
            {
                "mid": strate_maj_id,
                "mino": strate_mineure_id,
                "prov": deb["province"],
                "loc": deb["localite"],
            },
        )


def upgrade():
    # --- Schéma : colonnes FK (nullable pour permettre le backfill) --------
    op.add_column(
        "debarcaderes",
        sa.Column("strate_majeure_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "debarcaderes",
        sa.Column("strate_mineure_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_debarcaderes_strate_majeure_id",
        "debarcaderes",
        ["strate_majeure_id"],
    )
    op.create_index(
        "ix_debarcaderes_strate_mineure_id",
        "debarcaderes",
        ["strate_mineure_id"],
    )
    op.create_foreign_key(
        "fk_debarcadere_strate_majeure",
        "debarcaderes",
        "strates_majeures",
        ["strate_majeure_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_debarcadere_strate_mineure",
        "debarcaderes",
        "strates_mineures",
        ["strate_mineure_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- Données : backfill depuis province / localite ---------------------
    _backfill(op.get_bind())


def downgrade():
    op.drop_constraint(
        "fk_debarcadere_strate_mineure", "debarcaderes", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_debarcadere_strate_majeure", "debarcaderes", type_="foreignkey"
    )
    op.drop_index("ix_debarcaderes_strate_mineure_id", table_name="debarcaderes")
    op.drop_index("ix_debarcaderes_strate_majeure_id", table_name="debarcaderes")
    op.drop_column("debarcaderes", "strate_mineure_id")
    op.drop_column("debarcaderes", "strate_majeure_id")
    # NB : les strates majeures/mineures créées par le backfill ne sont PAS
    # supprimées (elles peuvent désormais servir ailleurs). Nettoyage manuel
    # si nécessaire.

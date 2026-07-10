"""remove_capa_from_debarcaderetype

Revision ID: 9b6bf835a4fe
Revises: b3da7960588f
Create Date: 2026-07-05 07:17:39.808951

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "9b6bf835a4fe"
down_revision: Union[str, None] = "b3da7960588f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

old_values = (
    "OFFICIEL",
    "INFORMEL",
    "SAISONNIER",
    "Centre d'Appui à la Pêche Artisanale",
)
new_values = ("OFFICIEL", "INFORMEL", "SAISONNIER")

enum_name = "debarcaderetype"
table_name = "debarcaderes"
column_name = "type"


def upgrade() -> None:
    # 1. Reclasser les lignes utilisant CAPA
    op.execute(f"""UPDATE {table_name}
            SET {column_name} = 'OFFICIEL'
            WHERE {column_name} = 'Centre d''Appui à la Pêche Artisanale'""")

    # 2. Renommer l'ancien type
    op.execute(f"ALTER TYPE {enum_name} RENAME TO {enum_name}_old")

    # 3. Créer le nouveau type
    sa.Enum(*new_values, name=enum_name).create(op.get_bind())

    # 4. Basculer la colonne
    op.execute(f"""ALTER TABLE {table_name}
            ALTER COLUMN {column_name}
            TYPE {enum_name}
            USING {column_name}::text::{enum_name}""")

    # 5. Supprimer l'ancien type
    op.execute(f"DROP TYPE {enum_name}_old")


def downgrade() -> None:
    op.execute(f"ALTER TYPE {enum_name} RENAME TO {enum_name}_old")
    sa.Enum(*old_values, name=enum_name).create(op.get_bind())
    op.execute(f"""ALTER TABLE {table_name}
            ALTER COLUMN {column_name}
            TYPE {enum_name}
            USING {column_name}::text::{enum_name}""")
    op.execute(f"DROP TYPE {enum_name}_old")

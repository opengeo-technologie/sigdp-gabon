"""update espece_id transaction mareyeur

Revision ID: 48adee70b0f1
Revises: e42bb1ff2b1d
Create Date: 2026-07-21 15:57:24.004972

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "48adee70b0f1"
down_revision: Union[str, None] = "e42bb1ff2b1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions_achat_mareyage",
        sa.Column("espece_id", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    pass

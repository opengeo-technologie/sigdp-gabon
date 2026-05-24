#!/usr/bin/env python3
"""
Script d'initialisation de la base de données SIGDP-GABON
Crée toutes les tables et le premier utilisateur administrateur
"""

import sys
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import engine, Base
from app.models.debarcadere import Debarcadere
from app.models.pecheur import Pecheur
from app.models.bateau import Bateau
from app.models.espece import Espece
from app.models.debarquement import Debarquement, DetailDebarquement
from app.models.user import User
from app.auth import get_password_hash
from sqlalchemy.orm import Session


def init_database():
    """Initialise toutes les tables de la base de données"""
    print("🔧 Initialisation de la base de données...")

    # Créer toutes les tables
    print("📊 Création des tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables créées avec succès")

    # Vérifier si l'admin existe déjà
    with Session(engine) as session:
        admin_exists = session.query(User).filter(User.username == "admin").first()

        if admin_exists:
            print("ℹ️  L'administrateur existe déjà")
            print(f"   Username: {admin_exists.username}")
            print(f"   Email: {admin_exists.email}")
            print(f"   Role: {admin_exists.role}")
        else:
            print("👤 Création de l'administrateur...")
            admin = User(
                email="admin@sigdp-gabon.ga",
                username="admin",
                hashed_password=get_password_hash("Admin@2025"),
                nom="Administrateur",
                prenom="Système",
                role="admin",
                is_active=True,
                is_superuser=True,
            )

            session.add(admin)
            session.commit()
            session.refresh(admin)

            print("✅ Administrateur créé avec succès!")
            print(f"   ID: {admin.id}")
            print(f"   Username: {admin.username}")
            print(f"   Email: {admin.email}")
            print(f"   Password: Admin@2025")
            print(f"   Role: {admin.role}")

    print("\n✨ Initialisation terminée!")
    print("\n🚀 Vous pouvez maintenant:")
    print("   1. Démarrer le serveur: python main.py")
    print("   2. Se connecter avec:")
    print("      - Username: admin")
    print("      - Password: Admin@2025")
    print("   3. Accéder à l'API: http://localhost:8000/api/docs")


def check_database():
    """Vérifie l'état de la base de données"""
    print("\n🔍 Vérification de la base de données...")

    with Session(engine) as session:
        # Compter les utilisateurs
        user_count = session.query(User).count()
        print(f"   Utilisateurs: {user_count}")

        # Compter les autres entités
        debarcadere_count = session.query(Debarcadere).count()
        pecheur_count = session.query(Pecheur).count()
        bateau_count = session.query(Bateau).count()
        espece_count = session.query(Espece).count()
        debarquement_count = session.query(Debarquement).count()

        print(f"   Débarcadères: {debarcadere_count}")
        print(f"   Pêcheurs: {pecheur_count}")
        print(f"   Bateaux: {bateau_count}")
        print(f"   Espèces: {espece_count}")
        print(f"   Débarquements: {debarquement_count}")


if __name__ == "__main__":
    print("=" * 60)
    print("  SIGDP-GABON - Initialisation de la base de données")
    print("=" * 60)
    print()

    try:
        init_database()
        check_database()

        print("\n" + "=" * 60)
        print("  ✅ Initialisation réussie!")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Erreur lors de l'initialisation: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

import os
import logging
import psycopg
from psycopg import sql
from psycopg.errors import DuplicateDatabase
from dotenv import load_dotenv
from sqlalchemy import create_engine
import sys

# Add project root to path to properly import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Database configuration
DB_NAME = os.getenv("DB_NAME", "actionitems")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

print(f"HOST: {DB_HOST}")
print(f"USER: {DB_USER}")
print(f"PORT: {DB_PORT}")
print(f"DB NAME: {DB_NAME}")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("db_setup.log"),
        logging.StreamHandler()
    ]
)

# Update required tables to match the models.py schema
REQUIRED_TABLES = {'meetings', 'goals', 'subtasks', 'assignees', 'dependencies', 'goal_assignees'}

def database_exists():
    try:
        with psycopg.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public';
                """)
                existing_tables = {row[0] for row in cur.fetchall()}

        missing_tables = REQUIRED_TABLES - existing_tables
        if missing_tables:
            logging.info(f"Missing tables detected: {missing_tables}")
            return False

        logging.info("All required tables already exist.")
        return True
    except Exception as e:
        logging.warning(f"Could not connect to database '{DB_NAME}': {e}")
        return False

def create_database():
    try:
        with psycopg.connect(
            dbname="postgres",
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            autocommit=True
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
                if not cur.fetchone():
                    cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DB_NAME)))
                    logging.info(f"Database '{DB_NAME}' created.")
                else:
                    logging.info(f"Database '{DB_NAME}' already exists.")
    except Exception as e:
        logging.error(f"Failed to create database: {e}", exc_info=True)

def create_tables():
    try:
        # Import models after ensuring the database exists
        from app.models import Base
        from app.database import engine
        
        logging.info("Creating tables from SQLAlchemy models...")
        Base.metadata.create_all(bind=engine)
        logging.info("Tables created successfully.")
    except Exception as e:
        logging.error(f"Failed to create tables: {e}", exc_info=True)

if __name__ == "__main__":
    if database_exists():
        logging.info("Database is ready. No setup needed.")
    else:
        logging.info("Running database setup...")
        create_database()
        create_tables()
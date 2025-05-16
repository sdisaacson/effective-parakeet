import os
import logging
import psycopg
from psycopg import sql
from psycopg.errors import DuplicateDatabase
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

print(f"HOST: {DB_HOST}")
print(f"USER: {DB_USER}")
print(f"PORT: {DB_PORT}")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("db_setup.log"),
        logging.StreamHandler()
    ]
)

REQUIRED_TABLES = {'meetings', 'items', 'subtasks'}

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
    schema_sql = """
    CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        date DATE,
        summary TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        meeting_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
        id INTEGER PRIMARY KEY,
        item_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignees (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_assignees (
        item_id INTEGER NOT NULL,
        assignee_id INTEGER NOT NULL,
        PRIMARY KEY (item_id, assignee_id),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id) REFERENCES assignees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dependencies (
        item_id INTEGER NOT NULL,
        depends_on_id INTEGER NOT NULL,
        PRIMARY KEY (item_id, depends_on_id),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (depends_on_id) REFERENCES items(id) ON DELETE CASCADE
    );
    """

    try:
        with psycopg.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        ) as conn:
            with conn.cursor() as cur:
                logging.info("Creating tables...")
                cur.execute(schema_sql)
                conn.commit()
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

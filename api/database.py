# Database Connection and Initialization
import psycopg2
from psycopg2 import pool
import os
import time

DATABASE_URL = os.environ.get('DATABASE_URL')

# Connection pooling for better performance
db_pool = None

def init_db_pool():
    """Initialize database connection pool with SSL support"""
    global db_pool
    
    if not DATABASE_URL:
        print("⚠️ DATABASE_URL not set, skipping pool initialization")
        return False
    
    try:
        # Add SSL mode to connection string if not present
        db_url = DATABASE_URL
        if 'sslmode' not in db_url:
            separator = '&' if '?' in db_url else '?'
            db_url = f"{db_url}{separator}sslmode=require"
        
        db_pool = psycopg2.pool.SimpleConnectionPool(
            1,  # minconn
            20,  # maxconn
            db_url,
            connect_timeout=10
        )
        print("✅ Database connection pool created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating connection pool: {e}")
        print(f"💡 Trying alternative connection method...")
        
        # Try with different SSL configurations
        try:
            import ssl
            db_pool = psycopg2.pool.SimpleConnectionPool(
                1,
                20,
                DATABASE_URL,
                connect_timeout=10,
                sslmode='require'
            )
            print("✅ Database connection pool created with SSL")
            return True
        except Exception as e2:
            print(f"❌ Alternative connection also failed: {e2}")
            raise

def get_db():
    """Get a connection from the pool with retry logic"""
    global db_pool
    max_retries = 3
    retry_delay = 1
    
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is not set")
    
    # Lazy initialization of pool for serverless environments
    if db_pool is None:
        try:
            init_db_pool()
        except Exception as e:
            print(f"⚠️ Could not initialize pool, will use direct connections: {e}")
    
    for attempt in range(max_retries):
        try:
            if db_pool:
                conn = db_pool.getconn()
                # Test the connection
                cur = conn.cursor()
                cur.execute('SELECT 1')
                cur.close()
                return conn
            else:
                # Fallback to direct connection if pool not initialized
                db_url = DATABASE_URL
                if db_url and 'sslmode' not in db_url:
                    separator = '&' if '?' in db_url else '?'
                    db_url = f"{db_url}{separator}sslmode=require"
                return psycopg2.connect(db_url, connect_timeout=10)
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"⚠️ Connection attempt {attempt + 1} failed, retrying...")
                time.sleep(retry_delay)
            else:
                print(f"❌ All connection attempts failed: {e}")
                raise

def return_db(conn):
    """Return connection to the pool"""
    if db_pool and conn:
        try:
            db_pool.putconn(conn)
        except Exception as e:
            print(f"⚠️ Error returning connection to pool: {e}")
            try:
                conn.close()
            except:
                pass

def init_database():
    """Initialize database tables if they don't exist"""
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            print(f"🔄 Initializing database (attempt {attempt + 1}/{max_retries})...")
            conn = get_db()
            cur = conn.cursor()
            
            # Read and execute init_db.sql (in parent directory)
            sql_path = os.path.join(os.path.dirname(__file__), '..', 'init_db.sql')
            with open(sql_path, 'r', encoding='utf-8') as f:
                sql = f.read()
                
                # Execute SQL in smaller chunks to avoid SSL timeout
                statements = [s.strip() for s in sql.split(';') if s.strip()]
                for statement in statements:
                    if statement:
                        cur.execute(statement)
                        conn.commit()
            
            cur.close()
            return_db(conn)
            print("✅ Database initialized successfully")
            return True
        except Exception as e:
            print(f"❌ Error initializing database (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                print(f"⏳ Waiting {retry_delay} seconds before retry...")
                time.sleep(retry_delay)
            else:
                print("❌ Failed to initialize database after all retries")
                raise

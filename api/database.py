# Database Connection and Initialization - Optimized with psycopg3
import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
import os
import time
import uuid
from cachetools import TTLCache
from functools import wraps
from typing import Optional, Any, Dict, List

DATABASE_URL = os.environ.get('DATABASE_URL')

# Advanced connection pooling with psycopg3 for better performance
db_pool: Optional[ConnectionPool] = None

# Query result caching for frequently accessed data
query_cache = TTLCache(maxsize=100, ttl=300)  # 5 minute cache

def cache_query(cache_key: str = None, ttl: int = 300):
    """Decorator for caching query results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key if not provided
            key = cache_key if cache_key else f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Check cache
            if key in query_cache:
                return query_cache[key]
            
            # Execute and cache result
            result = func(*args, **kwargs)
            query_cache[key] = result
            return result
        return wrapper
    return decorator

def invalidate_cache(pattern: str = None):
    """Invalidate cached queries matching pattern"""
    if pattern is None:
        query_cache.clear()
    else:
        keys_to_delete = [k for k in query_cache.keys() if pattern in str(k)]
        for key in keys_to_delete:
            del query_cache[key]

def init_db_pool():
    """Initialize optimized database connection pool with psycopg3"""
    global db_pool
    
    if not DATABASE_URL:
        return False
    
    try:
        # Add SSL mode to connection string if not present
        db_url = DATABASE_URL
        if 'sslmode' not in db_url:
            separator = '&' if '?' in db_url else '?'
            db_url = f"{db_url}{separator}sslmode=require"
        
        db_pool = ConnectionPool(
            conninfo=db_url,
            min_size=2,
            max_size=20,
            timeout=30,
            max_idle=300,
            max_lifetime=3600,
            kwargs={
                "row_factory": dict_row,
                "autocommit": False,
                "prepare_threshold": 5
            }
        )
        return True
    except Exception as e:
        raise

def get_db():
    """Get a connection from the optimized pool - context manager compatible"""
    global db_pool
    
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is not set")
    
    # Lazy initialization of pool for serverless environments
    if db_pool is None:
        try:
            init_db_pool()
        except Exception as e:
            raise
    
    try:
        # Get connection from pool - psycopg3 handles connection testing internally
        return db_pool.connection()
    except Exception as e:
        raise

def return_db(conn):
    """Return connection to the pool (for backward compatibility)"""
    if conn:
        try:
            conn.close()
        except Exception as e:
            pass

def execute_batch(query: str, params_list: List[tuple], fetch: bool = False) -> Optional[List[Dict]]:
    """Execute batch operations efficiently using psycopg3 pipeline mode"""
    with get_db() as conn:
        with conn.cursor() as cur:
            # Use pipeline mode for batch inserts/updates (much faster)
            with conn.pipeline() as pipe:
                for params in params_list:
                    cur.execute(query, params)
            conn.commit()
            
            if fetch:
                return cur.fetchall()
    return None

def execute_query(query: str, params: tuple = None, fetch_one: bool = False, fetch_all: bool = False) -> Optional[Any]:
    """Execute a single query with automatic connection handling"""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            
            if fetch_one:
                return cur.fetchone()
            elif fetch_all:
                return cur.fetchall()
            
            conn.commit()
    return None

def init_database():
    """Initialize database tables if they don't exist"""
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            
            with get_db() as conn:
                with conn.cursor() as cur:
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
            
            invalidate_cache()
            return True
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                raise

# Optimized database helper functions with caching

@cache_query(ttl=300)
def get_all_students_cached() -> List[Dict]:
    """Get all students with 5-minute cache"""
    query = 'SELECT * FROM students ORDER BY name ASC'
    return execute_query(query, fetch_all=True) or []

@cache_query(ttl=60)
def get_student_by_code_cached(code: str) -> Optional[Dict]:
    """Get student by code with 1-minute cache"""
    query = 'SELECT * FROM students WHERE code = %s'
    return execute_query(query, (code,), fetch_one=True)

@cache_query(ttl=10)
def get_student_skills_cached(student_id: str) -> List[Dict]:
    """Get student skills with 10-second cache for real-time updates"""
    query = '''
        SELECT s.id, s.student_id, s.name, s.level, s.description, s.category, s.notes, s.evidence_url,
               s.is_student_ready,
               s.created_at AT TIME ZONE 'UTC' as created_at,
               s.updated_at AT TIME ZONE 'UTC' as updated_at,
               (SELECT COUNT(*) FROM skill_evidence se WHERE se.skill_id = s.id AND (se.evidence_url NOT LIKE '%%youtube%%' AND se.evidence_url NOT LIKE '%%youtu.be%%')) as evidence_count,
               (SELECT se.evidence_url FROM skill_evidence se WHERE se.skill_id = s.id AND (se.evidence_url NOT LIKE '%%youtube%%' AND se.evidence_url NOT LIKE '%%youtu.be%%') ORDER BY se.created_at ASC LIMIT 1) as first_evidence_url,
               COALESCE(stmpl.max_test_attempts, 3) as max_test_attempts,
               COALESCE((SELECT COUNT(*) FROM skill_test_questions stq WHERE stq.template_id = stmpl.id), 0) as question_count,
               COALESCE((SELECT COUNT(*) FROM skill_test_attempts sta WHERE sta.skill_id = s.id AND sta.student_id = s.student_id), 0) as attempts_used
        FROM skills s
        LEFT JOIN skill_templates stmpl ON stmpl.name = s.name
        WHERE s.student_id = %s 
        ORDER BY s.level DESC, s.created_at DESC
    '''
    return execute_query(query, (student_id,), fetch_all=True) or []

def batch_insert_students(students_data: List[Dict]) -> List[Dict]:
    """Batch insert students efficiently - returns created students with IDs"""
    try:
        with get_db() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                created_students = []
                for student in students_data:
                    student_id = str(uuid.uuid4())
                    cur.execute(
                        '''INSERT INTO students (id, name, code, email, class, created_at, updated_at)
                           VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                           ON CONFLICT (code) DO NOTHING
                           RETURNING id, name, code, email, class''',
                        (student_id, student['name'], student['code'], student.get('email'), student.get('class'))
                    )
                    result = cur.fetchone()
                    if result:
                        created_students.append({
                            'id': str(result['id']),
                            'name': result['name'],
                            'code': result['code'],
                            'email': result['email'],
                            'class': result['class']
                        })
                conn.commit()
        
        invalidate_cache('get_all_students_cached')
        return created_students
    except Exception as e:
        print(f"[ERROR] batch_insert_students: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

def batch_insert_skills(skills_data: List[Dict]) -> bool:
    """Batch insert skills efficiently"""
    try:
        query = '''
            INSERT INTO skills (id, student_id, name, level, description, category, notes, evidence_url, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        '''
        params_list = [
            (str(uuid.uuid4()), s['student_id'], s['name'], s['level'], s.get('description'), 
             s.get('category'), s.get('notes'), s.get('evidence_url'))
            for s in skills_data
        ]
        execute_batch(query, params_list)
        # Invalidate relevant caches
        for skill in skills_data:
            invalidate_cache(f"get_student_skills_cached:{skill['student_id']}")
        return True
    except Exception as e:
        print(f"[ERROR] batch_insert_skills failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2 import pool
import os
from datetime import datetime
import uuid
import jwt
from functools import wraps
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='..', static_url_path='')
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
})

DATABASE_URL = os.environ.get('DATABASE_URL')
JWT_SECRET = os.environ.get('JWT_SECRET', '81d2c2e604b17872e26e6ed8d57dcad56cd39b252a9099430411ed63a70af565')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

# Connection pooling for better performance
db_pool = None

def init_db_pool():
    """Initialize database connection pool"""
    global db_pool
    try:
        db_pool = psycopg2.pool.SimpleConnectionPool(
            1,  # minconn
            20,  # maxconn
            DATABASE_URL
        )
        print("✅ Database connection pool created successfully")
    except Exception as e:
        print(f"❌ Error creating connection pool: {e}")
        raise

def get_db():
    """Get a connection from the pool"""
    if db_pool:
        return db_pool.getconn()
    else:
        # Fallback to direct connection if pool not initialized
        return psycopg2.connect(DATABASE_URL)

def return_db(conn):
    """Return connection to the pool"""
    if db_pool and conn:
        db_pool.putconn(conn)

def init_database():
    """Initialize database tables if they don't exist"""
    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Read and execute init_db.sql (in parent directory)
        sql_path = os.path.join(os.path.dirname(__file__), '..', 'init_db.sql')
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql = f.read()
            cur.execute(sql)
        
        conn.commit()
        cur.close()
        conn.close()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        raise

def verify_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if not token:
            return jsonify({'success': False, 'message': 'غير مصرح - لا يوجد رمز'}), 401
        
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'غير مصرح - انتهت صلاحية الرمز'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'غير مصرح - رمز غير صالح'}), 401
        
        # Token is valid, proceed with the route handler
        return f(*args, **kwargs)
    return decorated

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    password = data.get('password')
    
    if password != ADMIN_PASSWORD:
        return jsonify({'success': False, 'message':' كلمة المرور غير صحيحة'}), 401
    
    token = jwt.encode(
        {
            'role': 'admin',
            'adminId': 'admin-console',
            'loginTime': datetime.now().isoformat()
        },
        JWT_SECRET,
        algorithm='HS256'
    )
    
    # Ensure token is a string (PyJWT 2.x returns string, but just to be safe)
    if isinstance(token, bytes):
        token = token.decode('utf-8')
    
    return jsonify({
        'success': True,
        'message': 'تم تسجيل الدخول بنجاح',
        'token': token,
        'user': {'role': 'admin', 'name': 'المعلم'}
    })

@app.route('/api/admin/students', methods=['GET'])
@verify_admin
def get_students():
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT * FROM students ORDER BY name ASC')
        students = []
        for row in cur.fetchall():
            students.append({'id': row[0], 'name': row[1], 'code': row[2], 'email': row[3], 'class': row[4], 'created_at': row[5].isoformat() if row[5] else None, 'updated_at': row[6].isoformat() if row[6] else None})
        cur.close()
        return jsonify({'success': True, 'students': students})
    finally:
        return_db(conn)

@app.route('/api/admin/students', methods=['POST'])
@verify_admin
def add_student():
    data = request.json
    name = data.get('name')
    code = data.get('code')
    email = data.get('email')
    student_class = data.get('class')
    if not name or not code:
        return jsonify({'success': False, 'message': 'البيانات غير صحيحة'}), 400
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT id FROM students WHERE code = %s', (code,))
        if cur.fetchone():
            cur.close()
            return jsonify({'success': False, 'message': 'رقم الطالب موجود بالفعل'}), 400
        student_id = str(uuid.uuid4())
        cur.execute('INSERT INTO students (id, name, code, email, class, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *', (student_id, name, code, email, student_class))
        student = cur.fetchone()
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم إضافة الطالب بنجاح', 'student': {'id': student[0], 'name': student[1], 'code': student[2], 'email': student[3], 'class': student[4]}}), 201
    finally:
        return_db(conn)

@app.route('/api/admin/students/<student_id>', methods=['DELETE'])
@verify_admin
def delete_student(student_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('DELETE FROM skills WHERE student_id = %s', (student_id,))
        cur.execute('DELETE FROM students WHERE id = %s RETURNING *', (student_id,))
        student = cur.fetchone()
        if not student:
            cur.close()
            return jsonify({'success': False, 'message': 'الطالب غير موجود'}), 404
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم حذف الطالب بنجاح'})
    finally:
        return_db(conn)

@app.route('/api/admin/students/<student_id>/skills', methods=['POST'])
@verify_admin
def add_skill(student_id):
    data = request.json
    name = data.get('name')
    level = data.get('level', 1)
    description = data.get('description')
    category = data.get('category')
    notes = data.get('notes')
    if not name:
        return jsonify({'success': False, 'message': 'البيانات غير صحيحة'}), 400
    conn = get_db()
    try:
        cur = conn.cursor()
        skill_id = str(uuid.uuid4())
        cur.execute('INSERT INTO skills (id, student_id, name, level, description, category, notes, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *', (skill_id, student_id, name, level, description, category, notes))
        skill = cur.fetchone()
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم إضافة المهارة بنجاح', 'skill': {'id': skill[0], 'student_id': skill[1], 'name': skill[2], 'level': skill[3]}}), 201
    finally:
        return_db(conn)

@app.route('/api/admin/skills/<skill_id>', methods=['PUT'])
@verify_admin
def update_skill(skill_id):
    data = request.json
    name = data.get('name')
    level = data.get('level')
    description = data.get('description')
    category = data.get('category')
    notes = data.get('notes')
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('UPDATE skills SET name = COALESCE(%s, name), level = COALESCE(%s, level), description = COALESCE(%s, description), category = COALESCE(%s, category), notes = COALESCE(%s, notes), updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING *', (name, level, description, category, notes, skill_id))
        skill = cur.fetchone()
        if not skill:
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم تحديث المهارة بنجاح', 'skill': {'id': skill[0], 'name': skill[2], 'level': skill[3]}})
    finally:
        return_db(conn)

@app.route('/api/admin/skills/<skill_id>', methods=['DELETE'])
@verify_admin
def delete_skill(skill_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('DELETE FROM skills WHERE id = %s RETURNING *', (skill_id,))
        skill = cur.fetchone()
        if not skill:
            cur.close()
            return jsonify({'success': False, 'message': 'المهارة غير موجودة'}), 404
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم حذف المهارة بنجاح'})
    finally:
        return_db(conn)

@app.route('/api/student/login', methods=['POST'])
def student_login():
    data = request.json
    student_code = data.get('studentCode')
    if not student_code or len(student_code) < 4:
        return jsonify({'success': False, 'message': 'رقم الطالب غير صحيح'}), 400
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT * FROM students WHERE code = %s', (student_code,))
        student = cur.fetchone()
        if not student:
            cur.close()
            return jsonify({'success': False, 'message': 'رقم الطالب غير موجود'}), 404
        cur.close()
        return jsonify({'success': True, 'message': 'تم الدخول بنجاح', 'student': {'id': student[0], 'name': student[1], 'code': student[2], 'class': student[4], 'email': student[3]}})
    finally:
        return_db(conn)

@app.route('/api/student/<student_id>/skills', methods=['GET'])
def get_student_skills(student_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT * FROM skills WHERE student_id = %s ORDER BY level DESC, created_at DESC', (student_id,))
        skills = []
        for row in cur.fetchall():
            skills.append({'id': row[0], 'student_id': row[1], 'name': row[2], 'level': row[3], 'description': row[4], 'category': row[5], 'notes': row[6], 'created_at': row[7].isoformat() if row[7] else None, 'updated_at': row[8].isoformat() if row[8] else None})
        cur.close()
        return jsonify({'success': True, 'skills': skills})
    finally:
        return_db(conn)

@app.route('/api/custom-skills', methods=['GET'])
def get_custom_skills():
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('SELECT DISTINCT name, description FROM skills WHERE category = %s', ('custom',))
        skills = []
        for row in cur.fetchall():
            skills.append({'name': row[0], 'url': row[1] or ''})
        cur.close()
        return jsonify({'success': True, 'skills': skills})
    finally:
        return_db(conn)

@app.route('/api/custom-skills', methods=['POST'])
@verify_admin
def add_custom_skill():
    data = request.json
    name = data.get('name')
    url = data.get('url')
    if not name or not url:
        return jsonify({'success': False, 'message': 'البيانات غير صحيحة'}), 400
    conn = get_db()
    try:
        cur = conn.cursor()
        skill_id = str(uuid.uuid4())
        cur.execute('INSERT INTO skills (id, student_id, name, level, description, category, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', (skill_id, None, name, 0, url, 'custom'))
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم إضافة المهارة المخصصة'})
    finally:
        return_db(conn)

@app.route('/api/custom-skills/<skill_name>', methods=['DELETE'])
@verify_admin
def delete_custom_skill(skill_name):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute('DELETE FROM skills WHERE name = %s AND category = %s', (skill_name, 'custom'))
        conn.commit()
        cur.close()
        return jsonify({'success': True, 'message': 'تم حذف المهارة المخصصة'})
    finally:
        return_db(conn)

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'success': True, 'message': 'الخادم يعمل بشكل صحيح', 'timestamp': datetime.now().isoformat()})

@app.route('/')
def serve_index():
    return send_from_directory('..', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('..', path)

if __name__ == '__main__':
    # Initialize database and connection pool on startup
    init_database()
    init_db_pool()
    app.run()

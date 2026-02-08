# Main Flask Application
from flask import Flask
from flask_cors import CORS
import os
import sys
import traceback

# Add current directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Load environment variables (safe if .env doesn't exist)
try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass  # Vercel sets env vars directly

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__, static_folder='..', static_url_path='')
    
    # Configure CORS
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        }
    })
    
    # Import and register blueprints
    try:
        from routes.admin import admin_bp
        from routes.student import student_bp
        from routes.custom_skills import custom_skills_bp
        from routes.health import health_bp
        
        app.register_blueprint(admin_bp)
        app.register_blueprint(student_bp)
        app.register_blueprint(custom_skills_bp)
        app.register_blueprint(health_bp)
    except Exception as e:
        print(f"❌ Error importing/registering blueprints: {e}")
        traceback.print_exc()
        
        # Register a fallback error route
        @app.route('/')
        @app.route('/<path:path>')
        def error_route(path=''):
            return {
                'success': False,
                'message': f'Application initialization error: {str(e)}',
                'traceback': traceback.format_exc()
            }, 500
    
    # Add global error handler
    @app.errorhandler(Exception)
    def handle_error(error):
        """Global error handler"""
        error_trace = traceback.format_exc()
        print(f"Unhandled error: {error_trace}")
        return {
            'success': False,
            'message': str(error),
            'error': error_trace
        }, 500
    
    return app

# Create app instance for Vercel/WSGI servers
app = create_app()
print("✅ Flask app instance created")

if __name__ == '__main__':
    # Run development server
    print("🚀 Starting development server...")
    try:
        from database import init_db_pool, init_database
        init_db_pool()
        init_database()
        print("✅ Database initialized")
    except Exception as e:
        print(f"⚠️  Database initialization skipped: {e}")
    
    print("🎉 Application ready!")
    app.run(host='0.0.0.0', port=5000, debug=True)

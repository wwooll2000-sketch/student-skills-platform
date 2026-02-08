# Main Flask Application
from flask import Flask
from flask_cors import CORS
import os
import sys

# Load environment variables (safe if .env doesn't exist)
try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass  # Vercel sets env vars directly

# Import database and blueprint modules
try:
    from database import init_db_pool, init_database
    from routes.admin import admin_bp
    from routes.student import student_bp
    from routes.custom_skills import custom_skills_bp
    from routes.health import health_bp
except ImportError as e:
    print(f"Import error: {e}")
    # Try alternative import paths
    from api.database import init_db_pool, init_database
    from api.routes.admin import admin_bp
    from api.routes.student import student_bp
    from api.routes.custom_skills import custom_skills_bp
    from api.routes.health import health_bp

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
    
    # Register blueprints with error handling
    try:
        app.register_blueprint(admin_bp)
        app.register_blueprint(student_bp)
        app.register_blueprint(custom_skills_bp)
        app.register_blueprint(health_bp)
    except Exception as e:
        print(f"Error registering blueprints: {e}")
        raise
    
    # Add global error handler
    @app.errorhandler(Exception)
    def handle_error(error):
        """Global error handler"""
        import traceback
        error_trace = traceback.format_exc()
        print(f"Unhandled error: {error_trace}")
        return {
            'success': False,
            'message': str(error),
            'error': error_trace
        }, 500
    
    return app

# Create app instance for Vercel/WSGI servers
try:
    app = create_app()
    print("✅ Flask app created successfully")
except Exception as e:
    print(f"❌ Failed to create Flask app: {e}")
    import traceback
    traceback.print_exc()
    # Create a minimal fallback app
    app = Flask(__name__)
    
    @app.route('/')
    @app.route('/api/<path:path>')
    def error_page(path=''):
        import traceback
        return {
            'success': False,
            'message': f'Failed to initialize application: {str(e)}',
            'traceback': traceback.format_exc()
        }, 500

if __name__ == '__main__':
    # Initialize database for local development
    print("🚀 Starting development server...")
    init_db_pool()
    init_database()
    print("🎉 Application ready!")
    app.run(host='0.0.0.0', port=5000, debug=True)

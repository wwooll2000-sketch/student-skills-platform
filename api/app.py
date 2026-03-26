# Main Flask Application
from flask import Flask, send_from_directory, abort
from flask_cors import CORS
import os
import sys
import traceback
import logging

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
        from routes.admin_students import admin_students_bp
        from routes.admin_skills import admin_skills_bp
        from routes.admin_evidence import admin_evidence_bp
        from routes.admin_teacher import admin_teacher_bp
        from routes.admin_activities import admin_activities_bp
        from routes.admin_announcements import admin_announcements_bp
        from routes.student import student_bp
        from routes.custom_skills import custom_skills_bp
        from routes.health import health_bp

        app.register_blueprint(admin_bp)
        app.register_blueprint(admin_students_bp)
        app.register_blueprint(admin_skills_bp)
        app.register_blueprint(admin_evidence_bp)
        app.register_blueprint(admin_teacher_bp)
        app.register_blueprint(admin_activities_bp)
        app.register_blueprint(admin_announcements_bp)
        app.register_blueprint(student_bp)
        app.register_blueprint(custom_skills_bp)
        app.register_blueprint(health_bp)
    except Exception as e:
        # Capture error details before Python deletes the 'e' variable at end of except block
        _init_error_msg = str(e)
        _init_traceback = traceback.format_exc()

        # Register a fallback error route
        @app.route('/')
        @app.route('/<path:path>')
        def error_route(path=''):
            return {
                'success': False,
                'message': f'Application initialization error: {_init_error_msg}',
                'traceback': _init_traceback
            }, 500
    
    # Handle common static file requests
    @app.route('/favicon.ico')
    @app.route('/favicon.svg')
    def favicon():
        """Serve favicon or return 204 if not found"""
        try:
            # Try SVG first, then ICO
            from flask import request
            if request.path.endswith('.svg'):
                return send_from_directory(
                    os.path.join(app.root_path, '..'), 
                    'favicon.svg', 
                    mimetype='image/svg+xml'
                )
            else:
                return send_from_directory(
                    os.path.join(app.root_path, '..'), 
                    'favicon.ico', 
                    mimetype='image/vnd.microsoft.icon'
                )
        except:
            # Return 204 No Content instead of 404
            return '', 204
    
    @app.route('/robots.txt')
    def robots():
        """Serve robots.txt or return empty response"""
        try:
            return send_from_directory(
                os.path.join(app.root_path, '..'), 
                'robots.txt', 
                mimetype='text/plain'
            )
        except:
            # Return default robots.txt
            return 'User-agent: *\nAllow: /', 200, {'Content-Type': 'text/plain'}
    
    # Custom 404 handler to serve HTML or JSON based on request type
    @app.errorhandler(404)
    def handle_404(error):
        """Handle 404 errors gracefully with custom page for browsers"""
        from flask import request, send_from_directory
        path = request.path
        
        # Suppress logging for common missing files
        common_missing = ['/favicon.ico', '/robots.txt', '/apple-touch-icon.png', 
                         '/apple-touch-icon-precomposed.png']
        
        if any(path.endswith(missing) for missing in common_missing):
            return '', 204
        
        # Check if request accepts HTML (browser request)
        if request.accept_mimetypes.accept_html and not path.startswith('/api/'):
            try:
                return send_from_directory(
                    os.path.join(app.root_path, '..'),
                    '404.html'
                ), 404
            except:
                pass
        
        # Return JSON for API requests
        return {
            'success': False,
            'message': 'Resource not found',
            'path': path
        }, 404
    
    # Global error handler for 500 errors
    @app.errorhandler(500)
    def handle_500(error):
        """Handle 500 Internal Server Error"""
        from flask import request, send_from_directory
        
        # Check if request accepts HTML (browser request)
        if request.accept_mimetypes.accept_html and not request.path.startswith('/api/'):
            try:
                return send_from_directory(
                    os.path.join(app.root_path, '..'),
                    '500.html'
                ), 500
            except:
                pass
        
        # Return JSON for API requests
        return {
            'success': False,
            'message': 'Internal server error',
            'error': str(error)
        }, 500
    
    # Add global error handler for uncaught exceptions
    @app.errorhandler(Exception)
    def handle_error(error):
        """Global error handler"""
        from flask import request, send_from_directory
        
        # Log the error
        app.logger.error(f'Unhandled exception: {str(error)}', exc_info=True)
        
        # Check if request accepts HTML (browser request)
        if request.accept_mimetypes.accept_html and not request.path.startswith('/api/'):
            try:
                return send_from_directory(
                    os.path.join(app.root_path, '..'),
                    '500.html'
                ), 500
            except:
                pass
        
        # Return JSON for API requests
        return {
            'success': False,
            'message': str(error)
        }, 500
    
    return app

# Create app instance for Vercel/WSGI servers
app = create_app()

if __name__ == '__main__':
    import os
    # Only print startup messages in reloaded process to avoid duplicates
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        print("✅ Flask app created")
    
    try:
        from database import init_db_pool, init_database
        init_db_pool()
        init_database()
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
            print("✅ Database initialized")
            print("🚀 Server running on http://0.0.0.0:5000")
    except Exception as e:
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
            print(f"⚠️  Database error: {e}")
    
    app.run(host='0.0.0.0', port=5000, debug=True)

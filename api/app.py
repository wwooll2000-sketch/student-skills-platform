# Main Flask Application
from flask import Flask
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import database and blueprint modules
from database import init_db_pool, init_database
from routes.admin import admin_bp
from routes.student import student_bp
from routes.custom_skills import custom_skills_bp
from routes.health import health_bp

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
    
    # Register blueprints
    app.register_blueprint(admin_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(custom_skills_bp)
    app.register_blueprint(health_bp)
    
    return app

# Initialize database pool and create app at module level
init_db_pool()
init_database()

# Create app instance for Vercel/WSGI servers
app = create_app()

if __name__ == '__main__':
    # Run development server
    print("🚀 Starting development server...")
    print("🎉 Application ready!")
    app.run(host='0.0.0.0', port=5000, debug=True)

from flask import Flask, request, render_template, send_file, flash, jsonify
import os
import io
import json
import secrets
import logging
import time
from logging.handlers import RotatingFileHandler
from werkzeug.utils import secure_filename
from label_generator import LabelGenerator
from label_generator_3x1 import LabelGenerator3x1
import tempfile

app = Flask(__name__)

# Load secret key from environment variable or generate a secure random one
# WARNING: Using a random key means sessions won't persist across restarts
secret_key = os.environ.get('SECRET_KEY')
if not secret_key:
    secret_key = secrets.token_hex(32)
    print("WARNING: No SECRET_KEY environment variable set. Using random key.")
    print("Sessions will not persist across application restarts.")
    print("Set SECRET_KEY environment variable for production use.")

app.secret_key = secret_key
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max file size

# Configure logging
if not os.path.exists('logs'):
    os.makedirs('logs')

# Create rotating file handler (10MB max, keep 5 backups)
file_handler = RotatingFileHandler(
    'logs/app.log',
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5
)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)

# Add handler to app logger
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)

app.logger.info('Label Generator application startup')

# Cleanup orphaned temp files on startup
def cleanup_orphaned_temp_files(max_age_hours=24):
    """
    Delete orphaned temp PDF files on application startup.
    This catches files that were left behind from service restarts or crashes.

    Args:
        max_age_hours: Delete files older than this many hours (default: 24)
    """
    try:
        temp_dir = tempfile.gettempdir()
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600

        deleted_count = 0
        deleted_size = 0

        # Find all tmp*.pdf files in temp directory
        for filename in os.listdir(temp_dir):
            if filename.startswith('tmp') and filename.endswith('.pdf'):
                filepath = os.path.join(temp_dir, filename)
                try:
                    # Check file age
                    file_age = current_time - os.path.getmtime(filepath)
                    if file_age > max_age_seconds:
                        file_size = os.path.getsize(filepath)
                        os.unlink(filepath)
                        deleted_count += 1
                        deleted_size += file_size
                        app.logger.debug(f'Deleted orphaned temp file: {filename} (age: {file_age/3600:.1f}h)')
                except Exception as e:
                    app.logger.warning(f'Failed to delete orphaned temp file {filename}: {e}')

        if deleted_count > 0:
            app.logger.info(f'Startup cleanup: Deleted {deleted_count} orphaned temp files ({deleted_size/1024/1024:.2f} MB)')
        else:
            app.logger.info('Startup cleanup: No orphaned temp files found')

    except Exception as e:
        app.logger.error(f'Error during startup temp file cleanup: {e}', exc_info=True)

# Run cleanup on startup
cleanup_orphaned_temp_files()

ALLOWED_EXTENSIONS = {'xlsx', 'csv'}

# Track temp files for cleanup on next request (allows re-download if needed)
previous_temp_files = []

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    global previous_temp_files

    try:
        # Clean up temp files from previous request
        if previous_temp_files:
            for temp_path in previous_temp_files:
                try:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                        app.logger.debug(f'Cleaned up previous temp file: {temp_path}')
                except Exception as e:
                    app.logger.warning(f'Failed to cleanup previous temp file {temp_path}: {e}')
            previous_temp_files = []

        if 'file' not in request.files:
            app.logger.warning('Upload attempt with no file')
            return jsonify({'error': 'No file selected'}), 400

        file = request.files['file']
        if file.filename == '':
            app.logger.warning('Upload attempt with empty filename')
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            app.logger.warning(f'Upload attempt with invalid file type: {file.filename}')
            return jsonify({'error': 'Only .xlsx and .csv files are allowed'}), 400

        # Get label size selection (default to 2x1 for backward compatibility)
        label_size = request.form.get('label_size', '2x1')

        app.logger.info(f'Processing upload: {file.filename}, label_size: {label_size}')

        # Create appropriate label generator instance based on selection
        if label_size == '3x1':
            generator = LabelGenerator3x1()
        else:
            generator = LabelGenerator()

        # Process the file and generate PDF
        try:
            pdf_buffer, label_count = generator.process_file_and_generate_pdf(file)
            app.logger.info(f'Successfully generated {label_count} labels from {file.filename}')
        except ValueError as e:
            app.logger.error(f'Validation error processing {file.filename}: {str(e)}')
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            app.logger.error(f'Error processing {file.filename}: {str(e)}', exc_info=True)
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500

        # Create a temporary file for the PDF
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.write(pdf_buffer.getvalue())
        temp_file.close()

        # Track temp file for cleanup on next request (allows re-download if needed)
        previous_temp_files.append(temp_file.name)
        app.logger.debug(f'Created temp file: {temp_file.name} (will cleanup on next request)')

        # Return the PDF file with label count in header
        response = send_file(
            temp_file.name,
            as_attachment=True,
            download_name=f'labels_{secure_filename(file.filename)}.pdf',
            mimetype='application/pdf'
        )
        response.headers['X-Label-Count'] = str(label_count)
        return response

    except Exception as e:
        app.logger.error(f'Unexpected error in upload: {str(e)}', exc_info=True)
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/api/validate', methods=['POST'])
def validate_file():
    """Validate file and return detailed report of matched/unmatched rows"""
    try:
        if 'file' not in request.files:
            app.logger.warning('Validation attempt with no file')
            return jsonify({'error': 'No file selected'}), 400

        file = request.files['file']
        if file.filename == '':
            app.logger.warning('Validation attempt with empty filename')
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            app.logger.warning(f'Validation attempt with invalid file type: {file.filename}')
            return jsonify({'error': 'Only .xlsx and .csv files are allowed'}), 400

        # Get label size selection (default to 2x1 for backward compatibility)
        label_size = request.form.get('label_size', '2x1')

        app.logger.info(f'Validating file: {file.filename}, label_size: {label_size}')

        # Create appropriate label generator instance based on selection
        if label_size == '3x1':
            generator = LabelGenerator3x1()
        else:
            generator = LabelGenerator()

        # Validate the file and generate report
        try:
            report = generator.validate_file_and_generate_report(file)
            app.logger.info(f'Validation completed for {file.filename}')
            return jsonify(report), 200
        except ValueError as e:
            app.logger.error(f'Validation error for {file.filename}: {str(e)}')
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            app.logger.error(f'Error validating {file.filename}: {str(e)}', exc_info=True)
            return jsonify({'error': f'Error validating file: {str(e)}'}), 500

    except Exception as e:
        app.logger.error(f'Unexpected error in validation: {str(e)}', exc_info=True)
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

# Settings API Routes
@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Get current product mappings configuration"""
    try:
        config_file = 'product_mappings.json'
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            app.logger.info('Settings retrieved successfully')
            return jsonify(config)
        else:
            # Return default configuration
            app.logger.warning('Configuration file not found, returning defaults')
            default_config = {
                "product_types": [
                    "Soft Premium Tee - Black",
                    "Soft Premium Tee - White",
                    "Luxury Heavy Tee - Black",
                    "Luxury Heavy Tee - Vintage Black",
                    "Luxury Heavy Tee - Stone Wash"
                ],
                "shortening_rules": [],
                "max_bins": 12,
                "overflow_name": "THEPIT",
                "default_label_size": "3x1",
                "deadman_mode": False
            }
            return jsonify(default_config)
    except Exception as e:
        app.logger.error(f'Failed to load settings: {str(e)}', exc_info=True)
        return jsonify({'error': f'Failed to load settings: {str(e)}'}), 500

@app.route('/api/settings', methods=['POST'])
def save_settings():
    """Save updated product mappings configuration"""
    try:
        data = request.get_json()
        if not data:
            app.logger.warning('Settings save attempt with no data')
            return jsonify({'error': 'No data provided'}), 400

        # Validate the structure
        required_fields = ['product_types', 'shortening_rules', 'max_bins', 'overflow_name', 'default_label_size', 'deadman_mode']
        for field in required_fields:
            if field not in data:
                app.logger.warning(f'Settings save attempt missing field: {field}')
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Validate product_types is a list
        if not isinstance(data['product_types'], list):
            app.logger.warning('Settings save attempt with invalid product_types type')
            return jsonify({'error': 'product_types must be a list'}), 400

        # Validate shortening_rules structure
        if not isinstance(data['shortening_rules'], list):
            app.logger.warning('Settings save attempt with invalid shortening_rules type')
            return jsonify({'error': 'shortening_rules must be a list'}), 400

        for rule in data['shortening_rules']:
            if not isinstance(rule, dict) or 'pattern' not in rule or 'conditions' not in rule:
                app.logger.warning('Settings save attempt with invalid shortening rule structure')
                return jsonify({'error': 'Invalid shortening rule structure'}), 400

        # Validate max_bins
        if not isinstance(data['max_bins'], int) or data['max_bins'] < 1:
            app.logger.warning(f'Settings save attempt with invalid max_bins: {data.get("max_bins")}')
            return jsonify({'error': 'max_bins must be an integer >= 1'}), 400

        # Validate overflow_name
        if not isinstance(data['overflow_name'], str) or not data['overflow_name'].strip():
            app.logger.warning('Settings save attempt with invalid overflow_name')
            return jsonify({'error': 'overflow_name must be a non-empty string'}), 400

        # Validate default_label_size
        if data['default_label_size'] not in ['2x1', '3x1']:
            app.logger.warning(f'Settings save attempt with invalid default_label_size: {data.get("default_label_size")}')
            return jsonify({'error': 'default_label_size must be either "2x1" or "3x1"'}), 400

        # Validate deadman_mode
        if not isinstance(data['deadman_mode'], bool):
            app.logger.warning(f'Settings save attempt with invalid deadman_mode: {data.get("deadman_mode")}')
            return jsonify({'error': 'deadman_mode must be a boolean'}), 400

        # Save to file
        config_file = 'product_mappings.json'
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        app.logger.info(f'Settings saved successfully (product_types: {len(data["product_types"])}, rules: {len(data["shortening_rules"])})')
        return jsonify({'message': 'Settings saved successfully'})

    except Exception as e:
        app.logger.error(f'Failed to save settings: {str(e)}', exc_info=True)
        return jsonify({'error': f'Failed to save settings: {str(e)}'}), 500

@app.route('/api/settings/export', methods=['GET'])
def export_settings():
    """Export current settings as downloadable JSON file"""
    try:
        config_file = 'product_mappings.json'
        if os.path.exists(config_file):
            app.logger.info('Settings exported successfully')
            return send_file(
                config_file,
                as_attachment=True,
                download_name='product_mappings_export.json',
                mimetype='application/json'
            )
        else:
            app.logger.warning('Export attempt but no settings file found')
            return jsonify({'error': 'No settings file found'}), 404
    except Exception as e:
        app.logger.error(f'Failed to export settings: {str(e)}', exc_info=True)
        return jsonify({'error': f'Failed to export settings: {str(e)}'}), 500

@app.route('/api/settings/import', methods=['POST'])
def import_settings():
    """Import settings from uploaded JSON file"""
    try:
        if 'file' not in request.files:
            app.logger.warning('Import attempt with no file')
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            app.logger.warning('Import attempt with empty filename')
            return jsonify({'error': 'No file selected'}), 400

        if not file.filename.lower().endswith('.json'):
            app.logger.warning(f'Import attempt with invalid file type: {file.filename}')
            return jsonify({'error': 'Only JSON files are allowed'}), 400

        app.logger.info(f'Importing settings from {file.filename}')

        # Read and validate the JSON
        content = file.read().decode('utf-8')
        data = json.loads(content)

        # Validate structure (reuse validation from save_settings)
        if 'product_types' not in data or 'shortening_rules' not in data:
            app.logger.warning(f'Invalid configuration structure in {file.filename}')
            return jsonify({'error': 'Invalid configuration structure'}), 400

        if not isinstance(data['product_types'], list) or not isinstance(data['shortening_rules'], list):
            app.logger.warning(f'Invalid data types in {file.filename}')
            return jsonify({'error': 'Invalid data types in configuration'}), 400

        # Save the imported configuration
        config_file = 'product_mappings.json'
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        app.logger.info(f'Settings imported successfully from {file.filename}')
        return jsonify({'message': 'Settings imported successfully'})

    except json.JSONDecodeError:
        app.logger.error(f'Invalid JSON in {file.filename if "file" in locals() else "uploaded file"}')
        return jsonify({'error': 'Invalid JSON file'}), 400
    except Exception as e:
        app.logger.error(f'Failed to import settings: {str(e)}', exc_info=True)
        return jsonify({'error': f'Failed to import settings: {str(e)}'}), 500

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
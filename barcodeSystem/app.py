from flask import Flask, request, render_template, send_file, flash, jsonify
import os
import io
import json
from werkzeug.utils import secure_filename
from label_generator import LabelGenerator
from label_generator_3x1 import LabelGenerator3x1
import tempfile

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-in-production'
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max file size

ALLOWED_EXTENSIONS = {'xlsx', 'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file selected'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Only .xlsx and .csv files are allowed'}), 400

        # Get label size selection (default to 2x1 for backward compatibility)
        label_size = request.form.get('label_size', '2x1')

        # Create appropriate label generator instance based on selection
        if label_size == '3x1':
            generator = LabelGenerator3x1()
        else:
            generator = LabelGenerator()

        # Process the file and generate PDF
        try:
            pdf_buffer, label_count = generator.process_file_and_generate_pdf(file)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500

        # Create a temporary file for the PDF
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.write(pdf_buffer.getvalue())
        temp_file.close()

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
            return jsonify(config)
        else:
            # Return default configuration
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
                "default_label_size": "3x1"
            }
            return jsonify(default_config)
    except Exception as e:
        return jsonify({'error': f'Failed to load settings: {str(e)}'}), 500

@app.route('/api/settings', methods=['POST'])
def save_settings():
    """Save updated product mappings configuration"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Validate the structure
        required_fields = ['product_types', 'shortening_rules', 'max_bins', 'overflow_name', 'default_label_size']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Validate product_types is a list
        if not isinstance(data['product_types'], list):
            return jsonify({'error': 'product_types must be a list'}), 400

        # Validate shortening_rules structure
        if not isinstance(data['shortening_rules'], list):
            return jsonify({'error': 'shortening_rules must be a list'}), 400

        for rule in data['shortening_rules']:
            if not isinstance(rule, dict) or 'pattern' not in rule or 'conditions' not in rule:
                return jsonify({'error': 'Invalid shortening rule structure'}), 400

        # Validate max_bins
        if not isinstance(data['max_bins'], int) or data['max_bins'] < 1:
            return jsonify({'error': 'max_bins must be an integer >= 1'}), 400

        # Validate overflow_name
        if not isinstance(data['overflow_name'], str) or not data['overflow_name'].strip():
            return jsonify({'error': 'overflow_name must be a non-empty string'}), 400

        # Validate default_label_size
        if data['default_label_size'] not in ['2x1', '3x1']:
            return jsonify({'error': 'default_label_size must be either "2x1" or "3x1"'}), 400

        # Save to file
        config_file = 'product_mappings.json'
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return jsonify({'message': 'Settings saved successfully'})

    except Exception as e:
        return jsonify({'error': f'Failed to save settings: {str(e)}'}), 500

@app.route('/api/settings/export', methods=['GET'])
def export_settings():
    """Export current settings as downloadable JSON file"""
    try:
        config_file = 'product_mappings.json'
        if os.path.exists(config_file):
            return send_file(
                config_file,
                as_attachment=True,
                download_name='product_mappings_export.json',
                mimetype='application/json'
            )
        else:
            return jsonify({'error': 'No settings file found'}), 404
    except Exception as e:
        return jsonify({'error': f'Failed to export settings: {str(e)}'}), 500

@app.route('/api/settings/import', methods=['POST'])
def import_settings():
    """Import settings from uploaded JSON file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if not file.filename.lower().endswith('.json'):
            return jsonify({'error': 'Only JSON files are allowed'}), 400

        # Read and validate the JSON
        content = file.read().decode('utf-8')
        data = json.loads(content)

        # Validate structure (reuse validation from save_settings)
        if 'product_types' not in data or 'shortening_rules' not in data:
            return jsonify({'error': 'Invalid configuration structure'}), 400

        if not isinstance(data['product_types'], list) or not isinstance(data['shortening_rules'], list):
            return jsonify({'error': 'Invalid data types in configuration'}), 400

        # Save the imported configuration
        config_file = 'product_mappings.json'
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return jsonify({'message': 'Settings imported successfully'})

    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON file'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to import settings: {str(e)}'}), 500

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
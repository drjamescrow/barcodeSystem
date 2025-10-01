from flask import Flask, request, render_template, send_file, flash, jsonify
import os
import io
from werkzeug.utils import secure_filename
from label_generator import LabelGenerator
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

        # Create label generator instance
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

@app.route('/health')
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
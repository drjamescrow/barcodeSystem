# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Dependencies
```bash
# Install dependencies
pip install -r requirements.txt
```

### Running the Application
```bash
# Run development server
python app.py

# The application will be available at http://localhost:5000
```

### Testing
```bash
# Run the comprehensive test script
python test_app.py

# Test specific functionality with sample data
python -c "
from label_generator import LabelGenerator
import pandas as pd
df = pd.read_excel('shirt_orders.xlsx')  # Requires sample Excel file
generator = LabelGenerator()
pdf_buffer, count = generator.generate_pdf(df)
print(f'Generated {count} labels')
"
```

### Docker Deployment
```bash
# Build container
docker build -t label-generator .

# Run container
docker run -p 5000:5000 label-generator
```

## Architecture Overview

This is a Flask web application that generates thermal printer labels from Excel/CSV files containing product orders.

### Core Components

**app.py** - Flask web server with three main endpoints:
- `/` - Serves the web interface
- `/upload` - Processes file uploads and returns generated PDF
- `/health` - Health check endpoint

**label_generator.py** - Core business logic in `LabelGenerator` class:
- `process_file_and_generate_pdf()` - Main entry point that validates file format and columns
- `sort_by_size()` - Sorts labels by garment size (S→M→L→XL→2XL→3XL→4XL→5XL→6XL) for optimal picking workflow
- `fetch_datamatrix_image()` - Downloads and caches DataMatrix images from URLs, converts to high-contrast B&W
- `create_label_page()` - Generates individual label pages using ReportLab
- `generate_pdf()` - Orchestrates the entire PDF generation process

### Data Flow
1. User uploads Excel/CSV file via web interface
2. Flask validates file type and calls `LabelGenerator.process_file_and_generate_pdf()`
3. File is parsed into pandas DataFrame and validated for required columns
4. Labels are sorted by size for efficient garment picking
5. For each row, DataMatrix images are fetched from URLs and cached
6. PDF is generated with one 2"×1" label per page (144×72 points at 203 DPI)
7. Labels are duplicated based on quantity field
8. PDF is returned to user for download

### Key Business Logic

**Required Columns**: `Product`, `Size`, `Quantity`, `Datamatrix URL`

**Label Layout** (2" × 1" at 203 DPI):
- Size: Top center, bold 28pt font
- Product title: Left side, 9pt font, word-wrapped to avoid DataMatrix area
- DataMatrix: Right side, 0.6" square, fetched from URL

**Size Sorting**: Labels automatically sorted by garment size in picking order to minimize warehouse movement during fulfillment.

**Image Processing**: DataMatrix images are downloaded, converted to grayscale, then to binary B&W for crisp thermal printing, and cached to avoid redundant downloads.

### File Structure
```
/
├── app.py                 # Flask web application
├── label_generator.py     # Core PDF generation logic
├── requirements.txt       # Python dependencies
├── test_app.py           # Comprehensive test script
├── templates/index.html   # Web upload interface
├── static/               # CSS and JavaScript
├── Dockerfile           # Container configuration
└── render.yaml          # Render.com deployment config
```

### Error Handling
The application validates file formats, required columns, and handles network errors when fetching DataMatrix images. Missing images are skipped with warnings rather than failing the entire batch.
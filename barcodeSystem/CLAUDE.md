# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Dependencies
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Ghostscript (required for DataMatrix generation)
# Windows: Download from https://ghostscript.com/releases/gsdnld.html
# Linux/Mac: apt-get install ghostscript (or brew install ghostscript)
# Docker: Automatically installed via Dockerfile

# Configure environment variables (optional but recommended for production)
# Copy .env.example to .env and update values
cp .env.example .env

# Generate a secure secret key:
python -c "import secrets; print(secrets.token_hex(32))"
# Add the output to your .env file as SECRET_KEY
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

# Test 2x1 label generation with sample data
python -c "
from label_generator import LabelGenerator
import pandas as pd
df = pd.read_excel('shirt_orders.xlsx')  # Requires sample Excel file
generator = LabelGenerator()
pdf_buffer, count = generator.process_file_and_generate_pdf(df)
print(f'Generated {count} 2x1 labels')
"

# Test 3x1 label generation with sample data
python -c "
from label_generator_3x1 import LabelGenerator3x1
import pandas as pd
df = pd.read_excel('shirt_orders.xlsx')  # Requires sample Excel file
generator = LabelGenerator3x1()
pdf_buffer, count = generator.process_file_and_generate_pdf(df)
print(f'Generated {count} 3x1 labels')
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

This is a Flask web application that generates thermal printer labels from Excel/CSV files containing product orders. Supports both 2"×1" and 3"×1" label formats with automatic binning system for order organization.

### Core Components

**app.py** - Flask web server with eight main endpoints:
- `/` - Serves the web interface with label size selection (2x1 or 3x1)
- `/upload` - Processes file uploads and returns generated PDF based on selected label size
- `/api/settings` (GET) - Retrieves current product mappings configuration including bin settings
- `/api/settings` (POST) - Saves updated product mappings configuration with validation
- `/api/settings/export` - Exports current settings as downloadable JSON file
- `/api/settings/import` - Imports settings from uploaded JSON file
- `/health` - Health check endpoint

Core functions:
- `cleanup_orphaned_temp_files(max_age_hours=24)` - Runs on startup to delete orphaned temp PDFs older than specified hours (default: 24). Catches files left behind from service restarts or crashes. Logs cleanup activity (count and size of deleted files).

**label_generator.py** - Core business logic in `LabelGenerator` class for 2"×1" labels:
- `__init__()` - Initializes label dimensions (2"×1"), fonts, caches, and loads configuration from product_mappings.json
- `load_configuration()` - Loads product types, shortening rules, and bin settings from JSON configuration file
- `reload_configuration()` - Reloads configuration from file (useful for settings updates)
- `process_file_and_generate_pdf()` - Main entry point that auto-detects file format
- `detect_file_format()` - Automatically determines if file uses original or enhanced format
- `process_old_format()` - Handles original 4-column format
- `process_new_format()` - Handles enhanced order management format with HTML parsing and bin assignment
- `parse_item_name()` - Extracts product types, sizes, and titles from HTML descriptions
- `shorten_product_type()` - Shortens long product type names using dynamic configuration rules
- `normalize_size()` - Normalizes size text to standard abbreviations (Small→S, Medium→M, etc.)
- `extract_title_before_product_type()` - Extracts title text that appears before the product type
- `format_date()` - Converts various date formats to short format for labels
- `fetch_datamatrix_image()` - Downloads and caches DataMatrix images from URLs, converts to high-contrast B&W
- `generate_order_barcode()` - Generates Code 128 barcodes from order numbers (used in 3×1 labels)
- `generate_order_datamatrix()` - Generates DataMatrix codes from order numbers using treepoem (used in 2×1 labels)
- `wrap_text()` - Wraps text to fit within specified width (max 2 lines)
- `sort_by_size()` - Sorts labels by garment size (S→M→L→XL→2XL→3XL→4XL→5XL→6XL) for optimal picking workflow
- `sort_hierarchically()` - Sorts by rule order, condition order, then size for enhanced format
- `create_label_page()` - Generates basic label pages (original format)
- `create_enhanced_label_page()` - Generates enhanced labels with order DataMatrix, order details, and product DataMatrix
- `generate_pdf()` - PDF generation for original format
- `generate_enhanced_pdf()` - PDF generation for enhanced format with order details and bin assignment

**label_generator_3x1.py** - Extended version of `LabelGenerator` class for 3"×1" labels:
- Inherits same functionality as `label_generator.py` but with adjusted dimensions
- Label dimensions: 3"×1" (216×72 points) instead of 2"×1" (144×72 points)
- Wider layout allows for better text spacing and larger barcode areas
- Uses Code 128 barcodes for short order numbers (≤10 chars) and DataMatrix for long order numbers (≥11 chars) for better scanning reliability
- Product title text is truncated with ellipsis instead of wrapped to multiple lines
- Supports same bin system configuration (max_bins, overflow_name)
- Enhanced format includes bin name prominently displayed at top of label for warehouse organization

### Data Flow
1. User uploads Excel/CSV file via web interface and selects label size (2x1 or 3x1)
2. Flask validates file type and instantiates appropriate generator (`LabelGenerator` or `LabelGenerator3x1`)
3. Generator's `process_file_and_generate_pdf()` is called
4. `detect_file_format()` determines if file uses original or enhanced format
5. File is processed using appropriate method (`process_old_format()` or `process_new_format()`)
6. For enhanced format:
   - HTML is parsed to extract product types, sizes, and titles
   - Product types are shortened using configurable rules from product_mappings.json
   - Size names are normalized to standard abbreviations
   - Orders are assigned to bins based on order numbers (max_bins configuration)
   - Orders exceeding max_bins go to overflow bin (overflow_name configuration)
   - Rule matching metadata is stored for hierarchical sorting
7. Labels are sorted:
   - Original format: By garment size for efficient picking
   - Enhanced format: Hierarchically by bin, rule order, condition order, then size
8. For each row:
   - Product DataMatrix images are fetched from URLs and cached
   - Order number codes are generated and cached:
     - 2×1 labels: DataMatrix codes generated using treepoem
     - 3×1 labels: Code 128 barcodes for short order numbers (≤10 chars), DataMatrix for long order numbers (≥11 chars)
9. PDF is generated with one label per page:
   - 2"×1" labels: 144×72 points at 203 DPI
   - 3"×1" labels: 216×72 points at 203 DPI
10. Labels are duplicated based on quantity field
11. PDF is returned to user for download
12. Temporary PDF file management:
   - On app startup: Orphaned temp files older than 24 hours are automatically deleted
   - During upload: Previous request's temp files are cleaned up before processing new upload
   - After download: Current temp file is tracked for cleanup on next request (allows re-download if needed)

### Key Business Logic

**Original Format Required Columns**: `Product`, `Size`, `Quantity`, `Datamatrix URL`

**Enhanced Format Required Columns**: `Order - Number`, `Item - SKU`, `Item - Name`, `Item - Qty`, `Item - Image URL`, `Market - Store Name`, `Date - Ship By Date`

**HTML Parsing**: Extracts product types (e.g., "Soft Premium Tee - Black") and sizes from complex HTML product descriptions

**Label Layouts** at 203 DPI:

*2" × 1" Labels (144×72 points):*

Original Format:
- Size: Top center, bold 26pt font
- Product title: Left side, 7pt font, word-wrapped to avoid DataMatrix area
- DataMatrix: Right side, 0.6" square, fetched from URL

Enhanced Format:
- Product type: Top left, 10pt bold font (dynamically shortened per configuration)
- Size: Top right (same line as product type), bold 10pt font
- Product title: Left side, 4pt bold font, word-wrapped (max 2 lines)
- Product DataMatrix: Top right corner, 0.3825" square, fetched from URL
- "FRONT" text: Below product DataMatrix in 6pt font
- Order DataMatrix: Bottom left corner, 0.3825" square, generated from order number
- Order details: Above order DataMatrix, 4pt bold font in 2 rows:
  - Row 1: Order Number | SKU
  - Row 2: Store Name | Ship Date
- Item counter: Bottom right, "X of Y" in 8pt bold font
- Bin name: Bottom right (when multi-item), "BIN X" in 10pt bold font

*3" × 1" Labels (216×72 points):*

Same layout as 2"×1" but with:
- Wider spacing for better readability
- Order numbers encoded as Code 128 barcode for short numbers (≤10 chars, 2.2" × 0.4") or DataMatrix for long numbers (≥11 chars) for scanning reliability
- Product title text truncated with ellipsis at 2.2" width instead of wrapping
- Product DataMatrix remains at 0.45" square (top right)

**Configuration System**: Product types and shortening rules are stored in `product_mappings.json` and can be dynamically updated via the web interface settings API. Rules support pattern matching and conditional transformations with priority ordering.

**Bin Assignment System**: For enhanced format with 3×1 labels, orders are automatically assigned to bins for warehouse organization:
- Orders are distributed across bins based on order numbers
- Maximum number of bins is configurable (default: 16)
- Orders exceeding max bins go to overflow bin (default: "THEPIT")
- Bin names are prominently displayed on labels for easy sorting

**Hierarchical Sorting**: Enhanced format labels are sorted hierarchically:
1. Bin assignment (for 3×1 labels)
2. Rule index (based on which shortening rule matched)
3. Condition index (based on which condition within the rule matched)
4. Size order (S→M→L→XL→2XL→3XL→4XL→5XL→6XL)
5. Original order (for stable sorting)

**Original Format Sorting**: Labels sorted by garment size only for efficient picking.

**Order Number Encoding**:
- **2×1 labels**: Order numbers encoded as DataMatrix codes using treepoem library, positioned at bottom-left corner
- **3×1 labels**: Order numbers conditionally encoded based on length:
  - Short order numbers (≤10 chars): Code 128 barcodes with dynamic module width adjustment
  - Long order numbers (≥11 chars): DataMatrix codes using treepoem for better scanning reliability
- Both formats support full order numbers without truncation

**Image Processing**:
- Product DataMatrix images are downloaded from URLs, converted to grayscale, then to binary B&W for crisp thermal printing, and cached to avoid redundant downloads
- Order DataMatrix codes are generated using treepoem and cached for performance (used on all 2×1 labels and 3×1 labels with long order numbers)
- Code 128 barcodes are generated using python-barcode library and cached (used on 3×1 labels with short order numbers)

**Dependencies**:
- **treepoem**: Generates DataMatrix codes for order numbers (2×1 labels and 3×1 labels with long order numbers)
- **Ghostscript**: Required by treepoem for barcode generation (automatically installed in Docker, needs manual installation for local development on Windows)

### File Structure
```
/
├── app.py                    # Flask web application with label size routing
├── label_generator.py        # Core PDF generation logic for 2"×1" labels
├── label_generator_3x1.py    # Extended PDF generation for 3"×1" labels
├── product_mappings.json     # Configuration file for product types, shortening rules, and bin settings
├── requirements.txt          # Python dependencies
├── test_app.py              # Comprehensive test script
├── templates/index.html      # Web upload interface with label size selector
├── static/                  # CSS and JavaScript
├── Dockerfile              # Container configuration
├── render.yaml             # Render.com deployment config
└── CLAUDE.md               # Project documentation for Claude Code
```

### Configuration Format

**product_mappings.json** structure:
```json
{
  "default_label_size": "3x1",
  "max_bins": 16,
  "overflow_name": "THEPIT",
  "deadman_mode": false,
  "product_types": [
    "Soft Premium Tee - Black",
    "Soft Premium Tee - White",
    "Luxury Heavy Tee - Black"
  ],
  "shortening_rules": [
    {
      "pattern": "LUXURY HEAVY TEE",
      "conditions": [
        {
          "contains": "VINTAGE BLACK",
          "result": "LHT - VB"
        },
        {
          "contains": "STONE WASH",
          "result": "LHT - SW"
        },
        {
          "default": true,
          "result": "LHT - BLK"
        }
      ]
    }
  ]
}
```

- **default_label_size**: Default label size selection ("2x1" or "3x1")
- **max_bins**: Maximum number of bins for order distribution (integer >= 1)
- **overflow_name**: Name for the overflow bin when orders exceed max_bins
- **deadman_mode**: Boolean flag for special UI mode (default: false)
- **product_types**: List of product type strings to match in item names
- **shortening_rules**: Array of rules for shortening product type names
  - **pattern**: Product type pattern to match (case-insensitive)
  - **conditions**: Array of conditions checked in order
    - **contains**: Text to search for in full item name (optional)
    - **default**: Boolean indicating this is the fallback rule (optional)
    - **result**: The shortened text to display on labels

### Error Handling
The application validates:
- File formats (xlsx/csv only)
- Required columns for both original and enhanced formats
- JSON structure for configuration files
- Network errors when fetching DataMatrix images (skipped with warnings)
- Barcode generation errors (skipped with warnings)

Errors are handled gracefully with informative messages rather than failing entire batches.

## Environment Variables

The application supports the following environment variables for production configuration:

- **SECRET_KEY** (required for production): Flask secret key for session security
  - If not set, a random key is generated (sessions won't persist across restarts)
  - Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
  - Set via .env file or environment variable

- **PORT** (optional): Application port (default: 5000)

- **FLASK_DEBUG** (optional): Debug mode (default: False, NEVER set to True in production)

Example `.env` file (see `.env.example` for template):
```
SECRET_KEY=your-generated-secret-key-here
PORT=5000
FLASK_DEBUG=False
```

## Logging System

The application uses Python's built-in logging module with rotating file handlers for production-ready logging.

### Log Configuration
- **Log Directory**: `logs/`
- **Log File**: `logs/app.log`
- **Rotation**: 10MB per file, keeps 5 backups
- **Format**: `%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]`

### What Gets Logged
- **Startup Events**: Application initialization
- **File Uploads**: Filename, label size, label count
- **Validation**: File validation attempts and results
- **Settings Changes**: Configuration imports, exports, and updates
- **Errors**: Full stack traces for debugging
- **Warnings**: Invalid requests, missing files, validation failures

### Log Levels
- **INFO**: Normal operations (uploads, settings changes)
- **WARNING**: Invalid requests, missing data
- **ERROR**: Exceptions, failures, unexpected errors

### Viewing Logs
```bash
# View all logs
cat logs/app.log

# Follow logs in real-time
tail -f logs/app.log

# View only errors
grep ERROR logs/app.log

# View recent activity
tail -n 100 logs/app.log
```

Note: Log files are automatically excluded from git via `.gitignore`.
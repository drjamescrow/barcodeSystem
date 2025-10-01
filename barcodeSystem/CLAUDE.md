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
- `generate_order_barcode()` - Generates Code 128 barcodes from order numbers with dynamic width adjustment
- `wrap_text()` - Wraps text to fit within specified width (max 2 lines)
- `sort_by_size()` - Sorts labels by garment size (S→M→L→XL→2XL→3XL→4XL→5XL→6XL) for optimal picking workflow
- `sort_hierarchically()` - Sorts by rule order, condition order, then size for enhanced format
- `create_label_page()` - Generates basic label pages (original format)
- `create_enhanced_label_page()` - Generates enhanced labels with barcode, order details, and DataMatrix
- `generate_pdf()` - PDF generation for original format
- `generate_enhanced_pdf()` - PDF generation for enhanced format with order details and bin assignment

**label_generator_3x1.py** - Extended version of `LabelGenerator` class for 3"×1" labels:
- Inherits same functionality as `label_generator.py` but with adjusted dimensions
- Label dimensions: 3"×1" (216×72 points) instead of 2"×1" (144×72 points)
- Wider layout allows for better text spacing and larger barcode areas
- Title area uses 65% of width (vs 70% in 2×1) for better proportions
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
   - DataMatrix images are fetched from URLs and cached
   - Order number barcodes (Code 128) are generated and cached
9. PDF is generated with one label per page:
   - 2"×1" labels: 144×72 points at 203 DPI
   - 3"×1" labels: 216×72 points at 203 DPI
10. Labels are duplicated based on quantity field
11. PDF is returned to user for download

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
- Bin name: Top left corner (when applicable), 10pt bold font
- Product type: Top left, 10pt bold font (dynamically shortened per configuration)
- Size: Top right (same line as product type), bold 10pt font
- Product title: Left side, 4pt bold font, word-wrapped (max 2 lines)
- Order barcode: Left side middle area, Code 128 format, 1.32" × 0.4" (dynamically sized)
- DataMatrix: Right side middle area, 0.3825" square, fetched from URL
- Order details: Bottom, 4pt bold font in 2 rows:
  - Row 1: Order Number | SKU
  - Row 2: Store Name | Ship Date

*3" × 1" Labels (216×72 points):*

Same layout as 2"×1" but with:
- Wider spacing for better readability
- Larger barcode area for improved scanning
- Title area uses 65% of width (vs 70% in 2×1)
- DataMatrix remains at 0.45" square
- Better accommodation for longer product titles and order numbers

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

**Barcode Generation**: Order numbers are converted to Code 128 barcodes with dynamic module width adjustment based on number length to ensure consistent display size regardless of order number length.

**Image Processing**: DataMatrix images are downloaded, converted to grayscale, then to binary B&W for crisp thermal printing, and cached to avoid redundant downloads. Barcodes are similarly cached.

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
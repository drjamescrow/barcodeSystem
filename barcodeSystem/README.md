# Label Generator for Thermal Printers

A web application that generates 2"×1" labels from Excel/CSV files, optimized for thermal label printers at 203 DPI.

## Features

- 📄 **Dual Format Support**: Upload Excel (.xlsx) or CSV files with automatic format detection
- 🏷️ **Thermal Printer Optimized**: 2"×1" labels at 203 DPI resolution
- 📦 **Quantity Handling**: Automatically generates multiple labels based on quantity field
- 🔗 **URL-Based DataMatrix**: Fetches DataMatrix codes from URLs in your spreadsheet
- 📱 **Responsive Web Interface**: Drag-and-drop file upload with progress tracking
- 📋 **Smart Size Sorting**: Labels sorted by size (S→M→L→XL→2XL→3XL→4XL→5XL→6XL) for optimal garment picking workflow
- 🆕 **Enhanced Format**: Automatic parsing of HTML product descriptions and order details
- 📊 **Order Management**: Includes order numbers, SKUs, store names, and ship dates on labels
- 🐳 **Docker Ready**: Easy deployment with Docker and Render.com

## File Format Requirements

The application automatically detects and supports two file formats:

### Original Format
Your Excel (.xlsx) or CSV file must contain these columns:

| Column | Description | Example |
|--------|-------------|---------|
| **Product** | Product name/title | "Vintage T-Shirt Design" |
| **Size** | Size code | "M", "L", "XL", etc. |
| **Quantity** | Number of labels to generate | 1, 2, 3, etc. |
| **Datamatrix URL** | URL to the DataMatrix image | "https://example.com/datamatrix.png" |

### Enhanced Format (Order Management)
For systems with additional order details:

| Column | Description | Example |
|--------|-------------|---------|
| **Order - Number** | Order reference number | "BR-47678" |
| **Item - SKU** | Product SKU code | "BRSHIRT-THREATLEVEL-BK-L" |
| **Item - Name** | HTML product description (auto-parsed) | "SOFT PREMIUM TEE - Black - L - Product Title" |
| **Item - Qty** | Quantity to generate | 1, 2, 3, etc. |
| **Item - Image URL** | URL to DataMatrix image | "https://example.com/datamatrix.png" |
| **Market - Store Name** | Store/marketplace name | "Black Rabbit Shopify" |
| **Date - Ship By Date** | Shipping deadline | "9/26/2025 10:46:54 PM" |

### Sample Data

**Original Format:**
```csv
Product,Size,Quantity,Datamatrix URL
"The Love Witch She Loved Men To Death Retro Vintage Unisex Classic T-Shirt",M,1,https://cdn.shopify.com/files/QR_LoveWitch.png
```

**Enhanced Format:**
```csv
Order - Number,Item - SKU,Item - Name,Item - Qty,Item - Image URL,Market - Store Name,Date - Ship By Date
"BR-47678","BRSHIRT-THREATLEVEL-BK-L","SOFT PREMIUM TEE - Black - L - The Office Threat Level Midnight",1,"https://cdn.shopify.com/files/QR_ThreatLevel.png","Black Rabbit Shopify","9/26/2025 10:46:54 PM"
```

## Local Development

### Prerequisites
- Python 3.11 or higher
- pip (Python package manager)

### Setup
1. **Clone or download** this repository
2. **Navigate** to the project directory:
   ```bash
   cd label-generator
   ```
3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Run the application**:
   ```bash
   python app.py
   ```
5. **Open your browser** and go to: http://localhost:5000

## Docker Deployment

### Build and Run Locally
```bash
# Build the Docker image
docker build -t label-generator .

# Run the container
docker run -p 5000:5000 label-generator
```

### Deploy to Render.com
1. **Push your code** to a Git repository (GitHub, GitLab, etc.)
2. **Connect to Render.com** and create a new Web Service
3. **Select your repository** and branch
4. Render will automatically detect the `render.yaml` file and deploy

## Usage

1. **Open the web application** in your browser
2. **Upload your file** by dragging and dropping or clicking to browse
3. **Wait for processing** - the app will:
   - Parse your Excel/CSV file
   - Sort labels by size for optimal picking workflow
   - Download DataMatrix images from URLs
   - Generate PDF with one label per page
4. **Download the PDF** - Ready for printing on your thermal printer

### Size Sorting for Efficient Picking

The application automatically sorts all labels by garment size in this order:
**S → M → L → XL → 2XL → 3XL → 4XL → 5XL → 6XL**

This means when you print the labels and start picking garments, you'll move through size bins in a logical progression without having to go back and forth between different sizes. All Small labels print first, then all Medium labels, etc.

## Label Specifications

- **Physical Size**: 2" × 1" (50.8mm × 25.4mm)
- **Resolution**: 203 DPI
- **PDF Pages**: One label per page (for continuous printing)
- **Layout**:
  - Size: Top center, bold, large font
  - Product Title: Left side, word-wrapped
  - DataMatrix: Right side, high-contrast B&W

## Troubleshooting

### Common Issues

**"Missing required columns" error:**
- Ensure your file has exactly these column names: `Product`, `Size`, `Quantity`, `Datamatrix URL`

**"Error fetching DataMatrix" warning:**
- Check that DataMatrix URLs are accessible
- Verify URLs point to image files (PNG, JPG, etc.)

**Labels not printing correctly:**
- Verify your thermal printer is set to 203 DPI
- Check label stock is 2"×1" size
- Ensure PDF page size matches label dimensions

### File Size Limits
- Maximum file size: 10MB
- Recommended: Under 1000 rows for optimal performance

## Technical Details

### Technologies Used
- **Backend**: Python, Flask
- **PDF Generation**: ReportLab
- **Image Processing**: Pillow (PIL)
- **File Processing**: pandas, openpyxl
- **Frontend**: HTML5, CSS3, JavaScript

### Performance
- Image caching reduces redundant downloads
- Batch processing for large files
- Optimized for thermal printer workflow

## License

This project is open source. Feel free to modify and distribute according to your needs.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review your file format and column names
3. Test with a smaller sample file first
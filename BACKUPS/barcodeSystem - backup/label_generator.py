import pandas as pd
import io
import requests
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import inch
from reportlab.lib.colors import black
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from reportlab.lib.utils import ImageReader
import textwrap
import os
import tempfile

class LabelGenerator:
    def __init__(self):
        # Label dimensions for 2" x 1" at 203 DPI
        self.label_width = 2 * inch  # 144 points
        self.label_height = 1 * inch  # 72 points
        self.dpi = 203

        # Layout dimensions
        self.margin = 5  # 5 points margin
        self.datamatrix_size = 0.6 * inch  # ~43 points
        self.title_width = self.label_width * 0.65  # 65% for title, 35% for datamatrix

        # Font sizes
        self.size_font_size = 28
        self.title_font_size = 9

        # Image cache for DataMatrix
        self.image_cache = {}

    def process_file_and_generate_pdf(self, file):
        """Main method to process uploaded file and generate PDF"""
        # Read file based on extension
        filename = file.filename.lower()

        if filename.endswith('.xlsx'):
            df = pd.read_excel(file)
        elif filename.endswith('.csv'):
            df = pd.read_csv(file)
        else:
            raise ValueError("File must be .xlsx or .csv")

        # Validate required columns
        required_columns = ['Product', 'Size', 'Quantity', 'Datamatrix URL']
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

        # Generate PDF
        return self.generate_pdf(df)

    def fetch_datamatrix_image(self, url):
        """Download and cache DataMatrix image from URL"""
        if url in self.image_cache:
            return self.image_cache[url]

        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            # Open image and convert to high contrast B&W
            img = Image.open(io.BytesIO(response.content))

            # Convert to grayscale first, then to black and white for crisp edges
            img = img.convert('L')  # Grayscale
            img = img.point(lambda x: 0 if x < 128 else 255, '1')  # Binary B&W

            # Resize to target size while maintaining aspect ratio
            target_size = (int(self.datamatrix_size * self.dpi / 72),
                          int(self.datamatrix_size * self.dpi / 72))
            img = img.resize(target_size, Image.NEAREST)

            # Cache the processed PIL image
            self.image_cache[url] = img
            return img

        except Exception as e:
            print(f"Error fetching DataMatrix from {url}: {e}")
            return None

    def wrap_text(self, text, max_width, font_name, font_size, canvas_obj):
        """Wrap text to fit within specified width"""
        words = text.split()
        lines = []
        current_line = []

        for word in words:
            test_line = ' '.join(current_line + [word])
            text_width = canvas_obj.stringWidth(test_line, font_name, font_size)

            if text_width <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(' '.join(current_line))
                    current_line = [word]
                else:
                    # Word is too long, break it
                    lines.append(word[:20] + '...' if len(word) > 20 else word)

        if current_line:
            lines.append(' '.join(current_line))

        return lines[:3]  # Maximum 3 lines

    def create_label_page(self, c, product, size, datamatrix_url):
        """Create a single label page in the PDF"""
        # Set page size to exactly 2" x 1"
        c.setPageSize((self.label_width, self.label_height))

        # Draw size at top center (bold, large)
        c.setFont("Helvetica-Bold", self.size_font_size)
        size_width = c.stringWidth(size, "Helvetica-Bold", self.size_font_size)
        size_x = (self.label_width - size_width) / 2
        size_y = self.label_height - self.margin - self.size_font_size
        c.drawString(size_x, size_y, size)

        # Wrap and draw product title (left side)
        c.setFont("Helvetica", self.title_font_size)
        title_lines = self.wrap_text(
            product,
            self.title_width - 2 * self.margin,
            "Helvetica",
            self.title_font_size,
            c
        )

        # Draw title lines
        title_start_y = size_y - self.margin - self.title_font_size
        for i, line in enumerate(title_lines):
            line_y = title_start_y - (i * (self.title_font_size + 2))
            c.drawString(self.margin, line_y, line)

        # Draw DataMatrix image (right side)
        datamatrix_pil_img = self.fetch_datamatrix_image(datamatrix_url)
        if datamatrix_pil_img:
            # Position DataMatrix on right side, vertically centered
            datamatrix_x = self.label_width - self.datamatrix_size - self.margin
            datamatrix_y = (self.label_height - self.datamatrix_size) / 2

            # Draw PIL image using ImageReader
            c.drawImage(
                ImageReader(datamatrix_pil_img),
                datamatrix_x,
                datamatrix_y,
                width=self.datamatrix_size,
                height=self.datamatrix_size,
                preserveAspectRatio=True
            )

        # Finish the page
        c.showPage()

    def sort_by_size(self, df):
        """Sort dataframe by size in garment picking order"""
        # Define size order for optimal picking workflow
        size_order = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL']

        # Create a mapping for sorting
        size_map = {size: i for i, size in enumerate(size_order)}

        # Add a sort key column, using 999 for unknown sizes (they'll go to the end)
        df['_size_sort_key'] = df['Size'].map(lambda x: size_map.get(x, 999))

        # Add original index to maintain stable sorting
        df['_original_index'] = df.index

        # Sort by size order, then by original order for consistent results
        df_sorted = df.sort_values(['_size_sort_key', '_original_index']).reset_index(drop=True)

        # Remove the temporary columns
        df_sorted = df_sorted.drop(['_size_sort_key', '_original_index'], axis=1)

        return df_sorted

    def generate_pdf(self, df):
        """Generate PDF with one label per page for thermal printer"""
        # Sort labels by size for optimal picking workflow
        df_sorted = self.sort_by_size(df)

        # Create PDF buffer
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=(self.label_width, self.label_height))

        label_count = 0

        # Process each row in the sorted dataframe
        for _, row in df_sorted.iterrows():
            product = row['Product']
            size = row['Size']
            quantity = int(row['Quantity'])
            datamatrix_url = row['Datamatrix URL']

            # Generate the specified quantity of identical labels
            for _ in range(quantity):
                self.create_label_page(c, product, size, datamatrix_url)
                label_count += 1

        # Save PDF
        c.save()
        buffer.seek(0)

        return buffer, label_count
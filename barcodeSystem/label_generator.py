import pandas as pd
import io
import requests
import json
import os
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
import re
from datetime import datetime
import barcode
from barcode.writer import ImageWriter
import treepoem

class LabelGenerator:
    def __init__(self):
        # Label dimensions for 2" x 1" at 203 DPI
        self.label_width = 2 * inch  # 144 points
        self.label_height = 1 * inch  # 72 points
        self.dpi = 203

        # Layout dimensions
        self.margin = 5  # 5 points margin
        self.datamatrix_size = 0.3825 * inch  # 15% smaller than original 0.45" for space optimization
        self.title_width = self.label_width * 0.7   # 70% for title, 30% for datamatrix

        # Font sizes
        self.size_font_size = 10  # Same as product type font size
        self.title_font_size = 4   # Reduced further to fit vertically
        self.product_type_font_size = 10  # Increased to 10pt
        self.bottom_text_font_size = 4  # Same - will use 2 rows

        # Image cache for DataMatrix
        self.image_cache = {}

        # Barcode cache for order numbers
        self.barcode_cache = {}

        # DataMatrix cache for order numbers
        self.datamatrix_cache = {}

        # Load configuration from JSON file
        self.config_file = 'product_mappings.json'
        self.load_configuration()

    def load_configuration(self):
        """Load product types and shortening rules from JSON configuration file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.product_types = config.get('product_types', [])
                    self.shortening_rules = config.get('shortening_rules', [])
                    self.max_bins = config.get('max_bins', 12)
                    self.overflow_name = config.get('overflow_name', 'THEPIT')
            else:
                # Fallback to default configuration if file doesn't exist
                self.product_types = [
                    'Soft Premium Tee - Black',
                    'Soft Premium Tee - White',
                    'Luxury Heavy Tee - Black',
                    'Luxury Heavy Tee - Vintage Black',
                    'Luxury Heavy Tee - Stone Wash',
                    'Vintage Crew Sweatshirt - Pepper',
                    'Luxury Hoodie - Vintage Black',
                    'Unisex Fleece Sweat Shorts',
                    'Insulated Can Cooler',
                    'Trucker Hat'
                ]
                self.shortening_rules = []
                self.max_bins = 12
                self.overflow_name = 'THEPIT'
        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"Error loading configuration: {e}. Using defaults.")
            # Use default fallback
            self.product_types = [
                'Soft Premium Tee - Black',
                'Soft Premium Tee - White',
                'Luxury Heavy Tee - Black'
            ]
            self.shortening_rules = []
            self.max_bins = 12
            self.overflow_name = 'THEPIT'

    def reload_configuration(self):
        """Reload configuration from file - useful for settings updates"""
        self.load_configuration()

    def detect_file_format(self, df):
        """Detect whether this is the old or new format"""
        new_format_columns = ['Order - Number', 'Item - SKU', 'Item - Name', 'Item - Qty', 'Item - Image URL', 'Market - Store Name', 'Date - Ship By Date']
        old_format_columns = ['Product', 'Size', 'Quantity', 'Datamatrix URL']

        # Check if this looks like the new format
        new_format_score = sum(1 for col in new_format_columns if col in df.columns)
        old_format_score = sum(1 for col in old_format_columns if col in df.columns)

        if new_format_score >= 5:  # Most new format columns present
            return 'new'
        elif old_format_score >= 3:  # Most old format columns present
            return 'old'
        else:
            raise ValueError("Unable to detect file format. Please ensure your file has the required columns.")

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

        # Detect format and process accordingly
        file_format = self.detect_file_format(df)

        if file_format == 'new':
            return self.process_new_format(df)
        else:
            return self.process_old_format(df)

    def process_old_format(self, df):
        """Process the original format"""
        # Validate required columns
        required_columns = ['Product', 'Size', 'Quantity', 'Datamatrix URL']
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

        # Generate PDF using old format
        return self.generate_pdf(df)

    def process_new_format(self, df):
        """Process the new format with order details"""
        # Validate required columns for new format
        required_columns = ['Item - Name', 'Item - Qty', 'Item - Image URL']
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise ValueError(f"Missing required columns for new format: {', '.join(missing_columns)}")

        # Filter out rows without SKUs (like promotional items)
        df_filtered = df[df['Item - SKU'].notna() & (df['Item - SKU'] != '')].copy()

        if df_filtered.empty:
            raise ValueError("No valid product rows found in the file.")

        # Parse item names to extract product types and sizes
        parsed_data = []
        for _, row in df_filtered.iterrows():
            parsed_item = self.parse_item_name(row['Item - Name'])
            if parsed_item:  # Only process if we could extract the info
                data_row = {
                    'Product': parsed_item['title'],
                    'ProductType': parsed_item['product_type'],
                    'Size': parsed_item['size'],
                    'Quantity': int(row['Item - Qty']) if pd.notna(row['Item - Qty']) else 1,
                    'Datamatrix URL': row['Item - Image URL'],
                    'OrderNumber': row.get('Order - Number', ''),
                    'SKU': row.get('Item - SKU', ''),
                    'StoreName': row.get('Market - Store Name', ''),
                    'ShipDate': self.format_date(row.get('Date - Ship By Date', ''))
                }

                # Add sorting metadata if available
                if 'rule_index' in parsed_item:
                    data_row['RuleIndex'] = parsed_item['rule_index']
                    data_row['ConditionIndex'] = parsed_item['condition_index']
                    data_row['OriginalProductType'] = parsed_item['original_product_type']
                else:
                    # No rule matched - assign high values for sorting to end
                    data_row['RuleIndex'] = 9999
                    data_row['ConditionIndex'] = 9999
                    data_row['OriginalProductType'] = parsed_item.get('original_product_type', parsed_item['product_type'])

                parsed_data.append(data_row)

        if not parsed_data:
            raise ValueError("Could not extract product information from any items.")

        parsed_df = pd.DataFrame(parsed_data)

        # Generate PDF using enhanced format
        return self.generate_enhanced_pdf(parsed_df)

    def parse_item_name(self, item_name):
        """Extract product type, size, and title from HTML item name"""
        if pd.isna(item_name) or not item_name.strip():
            return None

        # Remove HTML tags
        clean_text = re.sub(r'<[^>]+>', '', item_name)

        # Try to match each product type (case insensitive), prioritizing longer matches
        product_type_found = None
        best_match = ""
        product_type_match = None

        for product_type in self.product_types:
            # Create a flexible pattern for the full product type
            full_pattern = product_type.replace(' - ', r'\s*-\s*').replace(' ', r'\s+')
            match = re.search(full_pattern, clean_text, re.IGNORECASE)

            if match:
                matched_text = match.group(0)
                # Prefer longer matches (more specific)
                if len(matched_text) > len(best_match):
                    product_type_found = matched_text
                    best_match = matched_text
                    product_type_match = match

        # If no full match found, try base types as fallback
        if not product_type_found:
            for product_type in self.product_types:
                base_type = product_type.split(' - ')[0]  # e.g., "Soft Premium Tee"
                pattern = base_type.replace(' ', r'\s+')
                match = re.search(pattern, clean_text, re.IGNORECASE)
                if match:
                    matched_text = match.group(0)
                    if len(matched_text) > len(best_match):
                        product_type_found = matched_text
                        best_match = matched_text
                        product_type_match = match

        if not product_type_found:
            return None

        # Determine if product type is at the beginning or end of the string
        product_type_start = product_type_match.start()
        product_type_end = product_type_match.end()
        text_length = len(clean_text)

        # Check what comes after the product type to determine pattern
        remaining_text = clean_text[product_type_end:].strip(' -,/')

        # If what follows is only a size/color pattern with no additional text,
        # then we have "Title - Product Type - Size" pattern
        # IMPORTANT: Put longer patterns BEFORE shorter ones to avoid partial matches
        # Support hyphenated forms like "3X-Large" and abbreviated forms like "3XL"
        after_product_type_pattern = r'^([0-9]+X-Large|[0-9]+XL|XL(?![A-Z])|X{1,6}-?Large|Small|Medium|Large|[SML](?![A-Z])|Orange\s+Camo|Black/White|Black/Black|White/Black|Red|Pepper)(\s+(Camo|Black|White))?$'
        is_only_size_color_after = bool(re.match(after_product_type_pattern, remaining_text, re.IGNORECASE))

        # Consider product type at "end" if it's in the last 50% of the string OR only size/color follows
        is_product_type_at_end = product_type_start > text_length * 0.5 or is_only_size_color_after

        size = ''
        title = ''

        if is_product_type_at_end:
            # Pattern: Title - Product Type - Size/Color
            # Extract title from beginning up to product type
            title = clean_text[:product_type_start].strip(' -,/')

            # Look for size/color after product type (supports comma, dash, and forward slash separators)
            remaining_text = clean_text[product_type_end:].strip(' -,/')
            if remaining_text:
                # Try to extract size from the remaining text
                # IMPORTANT: Order matters! Match longest patterns first
                # Match patterns like "3X-Large", "6X-Large", "3XL", "XL", "L" in that order
                size_pattern = r'^([0-9]+X-Large|[0-9]+XL|XL(?![A-Z])|X{1,6}-?Large|Small|Medium|Large|[SML](?![A-Z])|Orange\s+Camo|Black/White|Black/Black|White/Black)\b'
                size_match = re.search(size_pattern, remaining_text, re.IGNORECASE)
                if size_match:
                    potential_size = size_match.group(1)
                    # Only treat as size if it's actually a size, not a color
                    if not re.match(r'(Orange\s+Camo|Black/White|Black/Black|White/Black)', potential_size, re.IGNORECASE):
                        size = self.normalize_size(potential_size)
        else:
            # Original pattern: Product Type - Color - Size - Title
            # Extract size - look for specific size patterns after color
            # Support dash, comma, and forward slash separators
            # IMPORTANT: Order matters! Match longest patterns first
            size_pattern = r'-\s*(Black|White|Vintage Black|Stone Wash|Pepper)[-,/]\s*([0-9]+X-Large|[0-9]+XL|XL(?![A-Z])|X{1,6}-?Large|Small|Medium|Large|[SML](?![A-Z]))\s*[-,/]'
            size_match = re.search(size_pattern, clean_text, re.IGNORECASE)

            if size_match:
                size = self.normalize_size(size_match.group(2))
            else:
                # Fallback: look for size patterns after any dash, comma, or forward slash
                # IMPORTANT: Order matters! Match longest patterns first
                fallback_size = r'[-,/]\s*([0-9]+X-Large|[0-9]+XL|XL(?![A-Z])|X{1,6}-?Large|Small|Medium|Large|[SML](?![A-Z]))\s*([-,/]|$)'
                size_match = re.search(fallback_size, clean_text, re.IGNORECASE)
                if size_match:
                    size = self.normalize_size(size_match.group(1))

            # Extract the title (everything after size)
            # Support dash, comma, and forward slash separators
            # IMPORTANT: Order matters! Match longest patterns first
            title_pattern = r'[-,/]\s*([0-9]+X-Large|[0-9]+XL|XL(?![A-Z])|X{1,6}-?Large|Small|Medium|Large|[SML](?![A-Z]))\s*[-,/]\s*(.*?)$'
            title_match = re.search(title_pattern, clean_text, re.IGNORECASE)

            if title_match:
                title = title_match.group(2).strip()
            else:
                # Fallback: take everything after the last dash or comma
                last_separator_pos = max(clean_text.rfind(' - '), clean_text.rfind(', '))
                if last_separator_pos > 0:
                    title = clean_text[last_separator_pos + 2:].strip()
                else:
                    title = clean_text

            # Check if the extracted title is just color information or empty
            color_pattern = r'^(black|white|red|blue|green|yellow|orange|purple|grey|gray|navy|pink|brown|tan|beige|gold|silver)(\s*/\s*(black|white|red|blue|green|yellow|orange|purple|grey|gray|navy|pink|brown|tan|beige|gold|silver))*$'

            if not title.strip() or re.match(color_pattern, title.strip(), re.IGNORECASE):
                # Title is empty or just color info, try to extract from before product type
                title = self.extract_title_before_product_type(clean_text, product_type_found)

        # Final cleanup and fallbacks
        if not title.strip():
            if is_product_type_at_end:
                # For end pattern, title should already be extracted
                title = clean_text[:product_type_start].strip(' -,')
            else:
                title = clean_text

        # Shorten product type names for display
        display_product_type, match_metadata = self.shorten_product_type(product_type_found, clean_text)

        result = {
            'product_type': display_product_type,
            'size': size,
            'title': title
        }

        # Add match metadata if available
        if match_metadata:
            result.update(match_metadata)

        return result

    def shorten_product_type(self, product_type, full_text=None):
        """Shorten long product type names using dynamic configuration"""
        if not product_type:
            return product_type, None

        product_type_upper = product_type.upper()
        # Use full text for condition matching if available, otherwise use product type
        search_text = full_text.upper() if full_text else product_type_upper

        # Apply shortening rules from configuration
        for rule_index, rule in enumerate(self.shortening_rules):
            pattern = rule.get('pattern', '').upper()
            if pattern and pattern in product_type_upper:
                conditions = rule.get('conditions', [])

                # Check conditions in order
                for condition_index, condition in enumerate(conditions):
                    if condition.get('default', False):
                        # Default fallback rule
                        match_metadata = {
                            'rule_index': rule_index,
                            'condition_index': condition_index,
                            'original_product_type': product_type
                        }
                        return condition.get('result', product_type), match_metadata
                    elif 'contains' in condition:
                        contains_text = condition['contains'].upper()
                        # Check against the full text for better matching
                        if contains_text in search_text:
                            match_metadata = {
                                'rule_index': rule_index,
                                'condition_index': condition_index,
                                'original_product_type': product_type
                            }
                            return condition.get('result', product_type), match_metadata

                # If no conditions match but pattern does, return original
                break

        # No rule matched - return original with no metadata
        return product_type, None

    def normalize_size(self, size_text):
        """Normalize size text to standard abbreviations"""
        if not size_text:
            return ''

        size_upper = size_text.upper().strip()

        # Size mapping from spelled-out to abbreviated
        size_map = {
            'SMALL': 'S',
            'MEDIUM': 'M',
            'LARGE': 'L',
            'X-LARGE': 'XL',
            'XX-LARGE': '2XL',
            'XXX-LARGE': '3XL',
            'XXXX-LARGE': '4XL',
            'XXXXX-LARGE': '5XL',
            'XXXXXX-LARGE': '6XL',
            # Support numbered hyphenated forms like "3X-LARGE"
            '2X-LARGE': '2XL',
            '3X-LARGE': '3XL',
            '4X-LARGE': '4XL',
            '5X-LARGE': '5XL',
            '6X-LARGE': '6XL'
        }

        # Return mapped value if found, otherwise return original (for already abbreviated sizes)
        return size_map.get(size_upper, size_upper)

    def extract_title_before_product_type(self, clean_text, product_type):
        """Extract title text that appears before the product type"""
        if not product_type:
            return clean_text

        # Find where the product type appears in the text
        product_type_pos = clean_text.upper().find(product_type.upper())
        if product_type_pos > 0:
            # Get text before product type
            title_before = clean_text[:product_type_pos].strip()
            # Remove common prefixes and clean up
            title_before = title_before.strip(' -,')
            return title_before

        return clean_text

    def format_date(self, date_str):
        """Format ship date to short format"""
        if pd.isna(date_str) or not str(date_str).strip():
            return ''

        try:
            # Try to parse various date formats
            date_str = str(date_str).strip()

            # Handle formats like "9/26/2025 10:46:54 PM"
            if '/' in date_str and (':' in date_str or 'AM' in date_str or 'PM' in date_str):
                date_part = date_str.split(' ')[0]  # Just take date part
                parts = date_part.split('/')
                if len(parts) == 3:
                    month, day, year = parts
                    # Convert to short format: "9/26/25"
                    short_year = year[-2:] if len(year) == 4 else year
                    return f"{month}/{day}/{short_year}"

            # Handle other formats as needed
            return date_str[:10]  # Take first 10 chars as fallback
        except:
            return str(date_str)[:10]  # Fallback to first 10 characters

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

        return lines[:2]  # Maximum 2 lines to fit vertically

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

        # Draw DataMatrix image (top right corner)
        datamatrix_pil_img = self.fetch_datamatrix_image(datamatrix_url)
        if datamatrix_pil_img:
            # Position DataMatrix in top right corner
            datamatrix_x = self.label_width - self.datamatrix_size - self.margin
            datamatrix_y = self.label_height - self.datamatrix_size - self.margin

            # Draw PIL image using ImageReader
            c.drawImage(
                ImageReader(datamatrix_pil_img),
                datamatrix_x,
                datamatrix_y,
                width=self.datamatrix_size,
                height=self.datamatrix_size,
                preserveAspectRatio=True
            )

            # Draw "FRONT" text below DataMatrix in 6pt font
            c.setFont("Helvetica-Bold", 6)
            front_text = "FRONT"
            front_text_width = c.stringWidth(front_text, "Helvetica-Bold", 6)
            # Center the text below the DataMatrix
            front_text_x = datamatrix_x + (self.datamatrix_size - front_text_width) / 2
            front_text_y = datamatrix_y - 6  # 6 points below the DataMatrix
            c.drawString(front_text_x, front_text_y, front_text)

        # Finish the page
        c.showPage()

    def sort_hierarchically(self, df):
        """Sort dataframe hierarchically by rule order, condition order, then size"""
        # Define size order for optimal picking workflow
        size_order = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL']

        # Create a mapping for sorting
        size_map = {size: i for i, size in enumerate(size_order)}

        # Add sort keys
        df['_rule_sort_key'] = df.get('RuleIndex', 9999)
        df['_condition_sort_key'] = df.get('ConditionIndex', 9999)
        df['_size_sort_key'] = df['Size'].map(lambda x: size_map.get(x, 999))

        # Add original index to maintain stable sorting
        df['_original_index'] = df.index

        # Sort by rule order, condition order, size order, then original order
        df_sorted = df.sort_values([
            '_rule_sort_key',
            '_condition_sort_key',
            '_size_sort_key',
            '_original_index'
        ]).reset_index(drop=True)

        # Remove the temporary columns
        df_sorted = df_sorted.drop([
            '_rule_sort_key',
            '_condition_sort_key',
            '_size_sort_key',
            '_original_index'
        ], axis=1)

        return df_sorted

    def generate_order_barcode(self, order_number):
        """Generate a Code 128 barcode from order number"""
        if not order_number:
            return None

        # Check cache first
        if order_number in self.barcode_cache:
            return self.barcode_cache[order_number]

        try:
            # Create a barcode object using Code128
            code128 = barcode.get('code128', order_number, writer=ImageWriter())

            # Adjust module width based on order number length to maintain consistent display width
            # Longer order numbers need narrower bars to fit in the same space
            # Note: Module width below 0.15 causes rendering errors in the barcode library
            order_length = len(order_number)
            if order_length <= 10:
                module_width = 0.20
            elif order_length <= 15:
                module_width = 0.17
            else:
                # For very long orders (like Amazon 19-char), use minimum safe width
                # The barcode will be stretched horizontally in the PDF to fit
                module_width = 0.15

            # Configure the writer options
            writer_options = {
                'module_width': module_width,  # Dynamic width based on order length
                'module_height': 10,           # Increased height for consistent tall appearance
                'font_size': 0,                # No font size (no text)
                'text_distance': 0,            # No text distance
                'quiet_zone': 1,               # Minimal white space around barcode
                'write_text': False,           # NO human-readable text
                'dpi': self.dpi               # Match label DPI
            }

            # Generate the barcode as a PIL image
            barcode_buffer = io.BytesIO()
            code128.write(barcode_buffer, writer_options)
            barcode_buffer.seek(0)

            # Open as PIL image
            barcode_image = Image.open(barcode_buffer)

            # Cache the barcode image
            self.barcode_cache[order_number] = barcode_image

            return barcode_image

        except Exception as e:
            print(f"Error generating barcode for {order_number}: {e}")
            return None

    def generate_order_datamatrix(self, order_number):
        """Generate a DataMatrix code from order number"""
        if not order_number:
            return None

        # Check cache first
        if order_number in self.datamatrix_cache:
            return self.datamatrix_cache[order_number]

        try:
            # Generate DataMatrix using treepoem
            img = treepoem.generate_barcode(
                barcode_type='datamatrix',
                data=order_number
            )

            # Convert to grayscale, then to black and white for crisp edges (same as product DataMatrix)
            img = img.convert('L')  # Grayscale
            img = img.point(lambda x: 0 if x < 128 else 255, '1')  # Binary B&W

            # Resize to target size (match the product DataMatrix size)
            target_size = (int(self.datamatrix_size * self.dpi / 72),
                          int(self.datamatrix_size * self.dpi / 72))
            img = img.resize(target_size, Image.NEAREST)

            # Cache the DataMatrix image
            self.datamatrix_cache[order_number] = img

            return img

        except Exception as e:
            print(f"Error generating DataMatrix for {order_number}: {e}")
            return None

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

    def create_enhanced_label_page(self, c, product, product_type, size, datamatrix_url, order_number, sku, store_name, ship_date, bin_number, item_index, total_items):
        """Create a single enhanced label page with additional information"""
        # Set page size to exactly 2" x 1"
        c.setPageSize((self.label_width, self.label_height))

        # Draw product type and size on the same line at top
        top_y = self.label_height - self.margin - max(self.product_type_font_size, self.size_font_size)

        # Calculate available space for product type (leave room for size + separation + DataMatrix)
        c.setFont("Helvetica-Bold", self.size_font_size)  # Set font for size width calculation
        size_width = c.stringWidth(size, "Helvetica-Bold", self.size_font_size)

        # Available space = full width - margins - size width - separation (DataMatrix positioned below)
        available_width_single_line = self.label_width - (2 * self.margin) - size_width - 8

        # Use bold font for product type
        c.setFont("Helvetica-Bold", self.product_type_font_size)
        product_type_width = c.stringWidth(product_type, "Helvetica-Bold", self.product_type_font_size)

        # Force single line layout - truncate product type if necessary
        # Truncate product type if it doesn't fit with size on one line
        while product_type_width > available_width_single_line and len(product_type) > 3:
            product_type = product_type[:-1]
            product_type_width = c.stringWidth(product_type, "Helvetica-Bold", self.product_type_font_size)

        # Draw product type and size on same line
        c.drawString(self.margin, top_y, product_type)
        size_x = self.margin + product_type_width + 8  # 8 points separation
        c.setFont("Helvetica-Bold", self.size_font_size)
        c.drawString(size_x, top_y, size)

        # Title starts below this line
        title_start_y = top_y - self.margin - self.title_font_size

        # Wrap and draw product title (left side, below product type)
        c.setFont("Helvetica-Bold", self.title_font_size)
        # Reduce title width to account for barcode if order number exists
        title_wrap_width = (self.title_width - 2 * self.margin) if not order_number else (self.title_width - 2 * self.margin - 20)
        title_lines = self.wrap_text(
            product,
            title_wrap_width,
            "Helvetica-Bold",
            self.title_font_size,
            c
        )

        # Draw title lines using the calculated title_start_y
        for i, line in enumerate(title_lines):
            line_y = title_start_y - (i * (self.title_font_size + 2))
            c.drawString(self.margin, line_y, line)

        # Generate and draw DataMatrix for order number (bottom left corner)
        if order_number:
            order_datamatrix_img = self.generate_order_datamatrix(order_number)
            if order_datamatrix_img:
                # Position DataMatrix at bottom left corner
                datamatrix_x = self.margin
                datamatrix_y = self.margin

                # Draw DataMatrix image
                c.drawImage(
                    ImageReader(order_datamatrix_img),
                    datamatrix_x,
                    datamatrix_y,
                    width=self.datamatrix_size,
                    height=self.datamatrix_size,
                    preserveAspectRatio=True
                )

        # Draw DataMatrix image (top right corner)
        datamatrix_pil_img = self.fetch_datamatrix_image(datamatrix_url)
        if datamatrix_pil_img:
            # Position DataMatrix in top right corner
            datamatrix_x = self.label_width - self.datamatrix_size - self.margin
            datamatrix_y = self.label_height - self.datamatrix_size - self.margin

            # Draw PIL image using ImageReader
            c.drawImage(
                ImageReader(datamatrix_pil_img),
                datamatrix_x,
                datamatrix_y,
                width=self.datamatrix_size,
                height=self.datamatrix_size,
                preserveAspectRatio=True
            )

            # Draw "FRONT" text below DataMatrix in 6pt font
            c.setFont("Helvetica-Bold", 6)
            front_text = "FRONT"
            front_text_width = c.stringWidth(front_text, "Helvetica-Bold", 6)
            # Center the text below the DataMatrix
            front_text_x = datamatrix_x + (self.datamatrix_size - front_text_width) / 2
            front_text_y = datamatrix_y - 6  # 6 points below the DataMatrix
            c.drawString(front_text_x, front_text_y, front_text)

        # Draw bottom text in 2 rows with order details (positioned above DataMatrix)
        c.setFont("Helvetica-Bold", self.bottom_text_font_size)
        max_bottom_width = self.label_width - 2 * self.margin

        # First row: Order Number and SKU on same line
        bottom_row_1_parts = []
        if order_number:
            bottom_row_1_parts.append(f"Order: {order_number}")
        if sku:
            bottom_row_1_parts.append(f"SKU: {sku}")

        bottom_row_1_text = " | ".join(bottom_row_1_parts)

        # Truncate first row if too long
        while c.stringWidth(bottom_row_1_text, "Helvetica-Bold", self.bottom_text_font_size) > max_bottom_width and bottom_row_1_text:
            bottom_row_1_text = bottom_row_1_text[:-1]

        # Second row: Store Name and Ship Date
        bottom_row_2_parts = []
        if store_name:
            bottom_row_2_parts.append(f"Store: {store_name}")
        if ship_date:
            bottom_row_2_parts.append(f"Ship: {ship_date}")

        bottom_row_2_text = " | ".join(bottom_row_2_parts)

        # Truncate second row if too long
        while c.stringWidth(bottom_row_2_text, "Helvetica-Bold", self.bottom_text_font_size) > max_bottom_width and bottom_row_2_text:
            bottom_row_2_text = bottom_row_2_text[:-1]

        # Position both rows above the DataMatrix (instead of at very bottom)
        # DataMatrix occupies: y = margin to y = margin + datamatrix_size
        # Text starts just above the DataMatrix
        bottom_row_2_y = self.margin + self.datamatrix_size + 2  # 2pt gap above DataMatrix
        bottom_row_1_y = bottom_row_2_y + self.bottom_text_font_size + 2  # Second row above first row

        # Draw both rows
        if bottom_row_1_text:
            c.drawString(self.margin, bottom_row_1_y, bottom_row_1_text)
        if bottom_row_2_text:
            c.drawString(self.margin, bottom_row_2_y, bottom_row_2_text)

        # Draw bottom-right corner text for multi-item order grouping
        # "A of X" text (8pt bold, always shown)
        c.setFont("Helvetica-Bold", 8)
        item_text = f"{item_index} of {total_items}"
        item_text_width = c.stringWidth(item_text, "Helvetica-Bold", 8)
        item_text_x = self.label_width - item_text_width - self.margin
        item_text_y = self.margin + 2  # Bottom line
        c.drawString(item_text_x, item_text_y, item_text)

        # "BIN Y" text (10pt bold, only if multi-item order)
        if total_items > 1:
            c.setFont("Helvetica-Bold", 10)
            if isinstance(bin_number, str):
                # Overflow bin - display as-is
                bin_text = bin_number
            else:
                # Numbered bin
                bin_text = f"BIN {bin_number}"
            bin_text_width = c.stringWidth(bin_text, "Helvetica-Bold", 10)
            bin_text_x = self.label_width - bin_text_width - self.margin
            bin_text_y = self.margin + 14  # Line above (10pt font + spacing)
            c.drawString(bin_text_x, bin_text_y, bin_text)

        # Finish the page
        c.showPage()

    def generate_enhanced_pdf(self, df):
        """Generate PDF with enhanced labels for new format"""
        # Sort labels hierarchically by rule order, condition order, then size
        df_sorted = self.sort_hierarchically(df)

        # Assign bin numbers and item positions for multi-item orders
        # Group by OrderNumber and count items per order
        order_counts = df_sorted.groupby('OrderNumber').size().to_dict()

        # Identify multi-item orders (count > 1) and assign bin numbers
        multi_item_orders = {order: count for order, count in order_counts.items() if count > 1}
        bin_assignments = {}
        bin_counter = 1

        for order in df_sorted['OrderNumber'].unique():
            if order in multi_item_orders:
                # Assign bin number (1-max_bins, then overflow)
                if bin_counter <= self.max_bins:
                    bin_assignments[order] = bin_counter
                else:
                    bin_assignments[order] = self.overflow_name
                bin_counter += 1
            else:
                bin_assignments[order] = None  # Single-item order

        # Track item position within each order
        order_item_counters = {order: 0 for order in df_sorted['OrderNumber'].unique()}

        # Create PDF buffer
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=(self.label_width, self.label_height))

        label_count = 0

        # Process each row in the sorted dataframe
        for _, row in df_sorted.iterrows():
            product = row['Product']
            product_type = row['ProductType']
            size = row['Size']
            quantity = int(row['Quantity'])
            datamatrix_url = row['Datamatrix URL']
            order_number = row.get('OrderNumber', '')
            sku = row.get('SKU', '')
            store_name = row.get('StoreName', '')
            ship_date = row.get('ShipDate', '')

            # Get bin assignment and item counting info
            bin_number = bin_assignments.get(order_number, None)
            total_items = order_counts.get(order_number, 1)

            # Increment item counter for this order
            order_item_counters[order_number] += 1
            item_index = order_item_counters[order_number]

            # Generate the specified quantity of identical labels
            for _ in range(quantity):
                self.create_enhanced_label_page(
                    c, product, product_type, size, datamatrix_url,
                    order_number, sku, store_name, ship_date,
                    bin_number, item_index, total_items
                )
                label_count += 1

        # Save PDF
        c.save()
        buffer.seek(0)

        return buffer, label_count

    def validate_file_and_generate_report(self, file):
        """Validate file and generate detailed report of matched/unmatched rows"""
        # Read file based on extension
        filename = file.filename.lower()

        if filename.endswith('.xlsx'):
            df = pd.read_excel(file)
        elif filename.endswith('.csv'):
            df = pd.read_csv(file)
        else:
            raise ValueError("File must be .xlsx or .csv")

        # Detect format
        file_format = self.detect_file_format(df)

        if file_format == 'old':
            return self._validate_old_format(df)
        else:
            return self._validate_new_format(df)

    def _validate_old_format(self, df):
        """Validate old format file"""
        # Validate required columns
        required_columns = ['Product', 'Size', 'Quantity', 'Datamatrix URL']
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

        total_rows = len(df)
        matched_rows = []
        unmatched_rows = []

        # In old format, all rows with required columns are considered valid
        for idx, row in df.iterrows():
            row_data = {
                'row_number': idx + 2,  # +2 because Excel is 1-indexed and has header row
                'product': str(row.get('Product', '')),
                'size': str(row.get('Size', '')),
                'quantity': str(row.get('Quantity', '')),
                'datamatrix_url': str(row.get('Datamatrix URL', ''))
            }

            # Check if row has all required data
            if pd.notna(row['Product']) and pd.notna(row['Size']) and pd.notna(row['Quantity']):
                matched_rows.append(row_data)
            else:
                unmatched_rows.append(row_data)

        return {
            'format': 'old',
            'total_rows': total_rows,
            'matched_count': len(matched_rows),
            'unmatched_count': len(unmatched_rows),
            'matched_rows': matched_rows[:100],  # Limit to first 100 for performance
            'unmatched_rows': unmatched_rows,
            'suggestions': []
        }

    def _validate_new_format(self, df):
        """Validate new format file and generate detailed report"""
        # Validate required columns
        required_columns = ['Item - Name', 'Item - Qty', 'Item - Image URL']
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise ValueError(f"Missing required columns for new format: {', '.join(missing_columns)}")

        # Filter out rows without SKUs (like promotional items)
        df_filtered = df[df['Item - SKU'].notna() & (df['Item - SKU'] != '')].copy()

        if df_filtered.empty:
            raise ValueError("No valid product rows found in the file.")

        total_rows = len(df_filtered)
        matched_rows = []
        unmatched_rows = []
        unmatched_item_names = []  # For generating suggestions

        # Process each row
        for idx, row in df_filtered.iterrows():
            item_name = row['Item - Name']
            parsed_item = self.parse_item_name(item_name)

            row_data = {
                'row_number': idx + 2,  # +2 because Excel is 1-indexed and has header row
                'item_name': str(item_name),
                'order_number': str(row.get('Order - Number', '')),
                'sku': str(row.get('Item - SKU', ''))
            }

            if parsed_item:
                # Successfully matched
                row_data['matched_product_type'] = parsed_item['product_type']
                row_data['size'] = parsed_item['size']
                row_data['title'] = parsed_item['title']
                matched_rows.append(row_data)
            else:
                # Failed to match
                unmatched_rows.append(row_data)
                # Clean HTML and store for suggestions
                clean_text = re.sub(r'<[^>]+>', '', str(item_name))
                unmatched_item_names.append(clean_text)

        # Generate suggestions from unmatched items
        suggestions = self._generate_product_type_suggestions(unmatched_item_names)

        return {
            'format': 'new',
            'total_rows': total_rows,
            'matched_count': len(matched_rows),
            'unmatched_count': len(unmatched_rows),
            'matched_rows': matched_rows[:100],  # Limit to first 100 for performance
            'unmatched_rows': unmatched_rows,
            'suggestions': suggestions
        }

    def _generate_product_type_suggestions(self, unmatched_names):
        """Generate product type suggestions from unmatched item names"""
        if not unmatched_names:
            return []

        suggestions = []

        # Extract potential product type patterns
        # Look for common multi-word phrases that appear before sizes or at the beginning
        pattern_counts = {}

        for name in unmatched_names:
            # Look for patterns like "Product Name - Color" before size indicators
            # Remove size patterns first
            cleaned = re.sub(r'\b([SML]|[0-9]*XL|X{1,6}-?Large|Small|Medium|Large)\b', '', name, flags=re.IGNORECASE)

            # Split by common separators
            parts = re.split(r'[-,]', cleaned)

            # Take the first 2-3 meaningful parts
            for i, part in enumerate(parts[:3]):
                part = part.strip()
                if len(part) > 3 and not part.isdigit():  # Ignore very short or numeric parts
                    # Normalize the part
                    normalized = ' '.join(part.split())
                    if normalized:
                        pattern_counts[normalized] = pattern_counts.get(normalized, 0) + 1

        # Get patterns that appear more than once or are substantial
        suggested_patterns = []
        for pattern, count in sorted(pattern_counts.items(), key=lambda x: (-x[1], x[0])):
            if count > 1 or (count == 1 and len(unmatched_names) == 1):
                suggested_patterns.append(pattern)
            if len(suggested_patterns) >= 10:  # Limit to top 10 suggestions
                break

        # Also extract base product types (first significant phrase)
        base_types = set()
        for name in unmatched_names:
            # Look for the first substantial phrase (2-4 words)
            words = name.split()
            for i in range(min(4, len(words))):
                phrase = ' '.join(words[:i+2])
                if len(phrase) > 10:  # Substantial phrase
                    base_types.add(phrase.strip())
                    break

        # Combine and deduplicate suggestions
        all_suggestions = list(set(suggested_patterns + list(base_types)))

        return all_suggestions[:15]  # Return top 15 unique suggestions
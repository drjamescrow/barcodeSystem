import React, { useState, useRef, useEffect } from 'react';
import { fabric } from 'fabric';
import { 
  Card, 
  Button, 
  Select, 
  TextField, 
  LegacyStack, 
  Layout, 
  Banner,
  Spinner,
  ButtonGroup
} from '@shopify/polaris';
import { useSearchParams } from 'react-router-dom';
import apiService from '../services/api';

const ProductDecorator = () => {
  console.log('🚀 ProductDecorator component mounted/updated');
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [searchParams] = useSearchParams();
  const editProductId = searchParams.get('edit');
  const isEditMode = !!editProductId;
  const [canvas, setCanvas] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null); // Keep for canvas preview
  const [selectedVariants, setSelectedVariants] = useState([]); // Multiple variants for product creation
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedPrintArea, setSelectedPrintArea] = useState('front');
  const [colorAvailability, setColorAvailability] = useState({}); // Track which colors have product images
  const [primaryColor, setPrimaryColor] = useState(null); // Main color for Shopify product
  const [isSelectingPrimary, setIsSelectingPrimary] = useState(false); // Mode for selecting primary color
  const [hoverColor, setHoverColor] = useState(null); // Color being hovered for preview
  const [artwork, setArtwork] = useState(null);
  const [productTitle, setProductTitle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [artworkPosition, setArtworkPosition] = useState({ x: 0, y: 0 });
  const [artworkScale, setArtworkScale] = useState(1);
  const [isArtworkOutsidePrintArea, setIsArtworkOutsidePrintArea] = useState(false);
  
  // Edit mode specific state
  const [isLoadingEditProduct, setIsLoadingEditProduct] = useState(isEditMode);
  const [editingProduct, setEditingProduct] = useState(null);

  // Initialize Fabric.js canvas
  const initializeCanvas = (canvasElement) => {
    if (!canvasElement) {
      console.log('🚫 Canvas initialization skipped: no element');
      return;
    }
    
    if (canvas) {
      console.log('🚫 Canvas initialization skipped: canvas already exists');
      return;
    }
    
    if (canvasElement._fabricCanvas) {
      console.log('🚫 Canvas initialization skipped: element already has Fabric canvas');
      setCanvas(canvasElement._fabricCanvas);
      return;
    }

    console.log('🎨 Creating new Fabric.js canvas', {
      element: canvasElement,
      elementWidth: canvasElement.width,
      elementHeight: canvasElement.height
    });
    
    try {
      const fabricCanvas = new fabric.Canvas(canvasElement, {
        width: 500,
        height: 500,
        selection: true,
        preserveObjectStacking: true,
        backgroundColor: '#f8f9fa'
      });

      console.log('✅ Fabric.js canvas created successfully:', {
        width: fabricCanvas.width,
        height: fabricCanvas.height,
        hasContextContainer: !!fabricCanvas.contextContainer
      });

      // Configure canvas options
      fabric.Object.prototype.borderColor = '#007bff';
      fabric.Object.prototype.cornerColor = '#007bff';
      fabric.Object.prototype.cornerStyle = 'circle';
      fabric.Object.prototype.transparentCorners = false;
      fabric.Object.prototype.cornerSize = 8;

      console.log('🔧 Canvas options configured');

      // Initialize canvas created flag (like FancyProductDesigner)
      fabricCanvas._canvasCreated = false;
      fabricCanvas.__printAreaRendered = false;

      // Set up after:render event like FancyProductDesigner
      fabricCanvas.on('after:render', function() {
        if (!fabricCanvas._canvasCreated) {
          console.log('🎯 Canvas after:render - marking as created');
          fabricCanvas._canvasCreated = true;
        }
        
        // Load product image and render print area when canvas is ready
        if (selectedProduct && !fabricCanvas.__productRendered) {
          console.log('🎯 Canvas fully ready - loading product image and print area');
          loadProductImage(fabricCanvas);
          renderPrintArea(fabricCanvas);
          fabricCanvas.__productRendered = true;
        }
      });

      console.log('🔄 Setting canvas state...', {
        fabricCanvas,
        hasContextContainer: !!fabricCanvas.contextContainer,
        canvasReady: !!fabricCanvas.contextContainer
      });

      // Store the fabric canvas on the element to prevent recreation
      canvasElement._fabricCanvas = fabricCanvas;
      
      setCanvas(fabricCanvas);
      console.log('🔄 Canvas state set, should trigger re-render');
      
      // Force initial render to trigger after:render event
      try {
        fabricCanvas.renderAll();
        console.log('🎨 Initial canvas render completed - waiting for after:render event');
      } catch (error) {
        console.error('❌ Error in initial canvas render:', error);
      }

    } catch (error) {
      console.error('❌ Failed to create Fabric.js canvas:', error);
      console.error('Error details:', {
        error,
        fabricAvailable: !!fabric,
        canvasElement: canvasElement,
        elementType: canvasElement?.tagName
      });
      
      // Set a flag to indicate initialization failed
      setError('Failed to initialize canvas. Please refresh the page.');
    }
  };

  // Cleanup canvas on unmount
  useEffect(() => {
    return () => {
      if (canvas && !canvas.disposed) {
        console.log('🧹 Disposing canvas on unmount');
        try {
          canvas.off('after:render');
          canvas.dispose();
          // Clean up cached references in case canvas element persists
          if (canvasRef.current) {
            delete canvasRef.current._fabricCanvas;
            delete canvasRef.current._fabricInitialized;
          }
        } catch (error) {
          console.error('Error disposing canvas on unmount:', error);
        }
      }
    };
  }, [canvas]);

  // Initialize product and print area after canvas is set and product is available
  useEffect(() => {
    if (canvas && selectedProduct && selectedColors.length > 0) {
      console.log('🎯 Initializing product display for canvas');
      
      // Check if canvas is ready and render immediately, or set up handler
      if (canvas.contextContainer) {
        console.log('🎯 Canvas ready - loading product image and print area immediately');
        loadProductImage(canvas);
        renderPrintArea(canvas);
        canvas.__productRendered = true;
      } else {
        console.log('🎯 Canvas not ready - will render when ready');
        // Canvas will render via the main after:render handler
      }
    }
  }, [canvas, selectedProduct, selectedColors]);

  // Load product image onto canvas
  const loadProductImage = (fabricCanvas) => {
    if (!selectedProduct || !fabricCanvas || !selectedColors.length) {
      console.warn('⚠️ Cannot load product image - missing dependencies');
      return;
    }

    const selectedColor = selectedColors[0]; // Use first selected color
    const productImage = selectedProduct.images?.find(img => 
      img.color === selectedColor && img.view === selectedPrintArea
    );

    if (!productImage?.image_url) {
      console.warn('⚠️ No product image found for:', { color: selectedColor, view: selectedPrintArea });
      return;
    }

    console.log('🖼️ Loading product image:', productImage.image_url);

    // Remove existing product image if any
    const existingProductImage = fabricCanvas.getObjects().find(obj => obj.name === 'productImage');
    if (existingProductImage) {
      fabricCanvas.remove(existingProductImage);
    }

    // Load and add product image as background-like object
    fabric.Image.fromURL(productImage.image_url, (img) => {
      // Scale image to fit canvas
      const scale = Math.min(
        fabricCanvas.width / img.width,
        fabricCanvas.height / img.height
      );
      
      img.set({
        name: 'productImage',
        left: fabricCanvas.width / 2,
        top: fabricCanvas.height / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        excludeFromExport: true // Don't include in exports
      });

      // Add as first object (background)
      fabricCanvas.insertAt(img, 0);
      fabricCanvas.renderAll();
      console.log('✅ Product image loaded successfully');
    }, { crossOrigin: 'anonymous' });
  };

  // Render print area boundaries
  const renderPrintArea = (fabricCanvas) => {
    console.log('🖼️ renderPrintArea called:', {
      hasCanvas: !!fabricCanvas,
      hasProduct: !!selectedProduct,
      printArea: selectedPrintArea,
      canvasContextContainer: !!fabricCanvas?.contextContainer
    });

    if (!selectedProduct || !fabricCanvas) {
      console.warn('⚠️ renderPrintArea early return - missing dependencies');
      return;
    }

    const printArea = selectedProduct.printAreas[selectedPrintArea];
    if (!printArea) {
      console.warn('⚠️ renderPrintArea early return - no print area found for:', selectedPrintArea);
      return;
    }

    // Define conversion function for inches to pixels
    const CANVAS_SCALE = 1; // Define scale factor if needed
    const toPx = (inch, dpi = printArea.maxDpi || 300) => inch * dpi / CANVAS_SCALE;
    
    // Calculate actual dimensions - handle both pixel and inch formats
    const rectWidth = printArea.width ?? (printArea.maxWidth ? toPx(printArea.maxWidth) : 0);
    const rectHeight = printArea.height ?? (printArea.maxHeight ? toPx(printArea.maxHeight) : 0);

    console.log('📏 Print area data:', {
      name: selectedPrintArea,
      x: printArea.x_position || printArea.x || 0,
      y: printArea.y_position || printArea.y || 0,
      width: printArea.width,
      height: printArea.height,
      maxWidth: printArea.maxWidth,
      maxHeight: printArea.maxHeight,
      calculatedWidth: rectWidth,
      calculatedHeight: rectHeight,
      dpi: printArea.maxDpi || 300
    });

    // Check if canvas is ready before proceeding
    if (!fabricCanvas.contextContainer) {
      console.warn('⚠️ Canvas not ready for rendering');
      return;
    }

    try {
      // Remove existing print area rectangle
      const existingPrintArea = fabricCanvas.getObjects().find(obj => obj.name === 'printArea');
      if (existingPrintArea) {
        console.log('🗑️ Removing existing print area');
        fabricCanvas.remove(existingPrintArea);
      }

      console.log('🎨 Creating print area rectangle');
      // Create print area boundary rectangle (like FPD's printing box)
      const printAreaRect = new fabric.Rect({
        width: rectWidth,
        height: rectHeight,
        left: printArea.x_position || printArea.x || 0,
        top: printArea.y_position || printArea.y || 0,
        fill: 'rgba(0, 123, 255, 0.1)', // Subtle fill like FPD
        stroke: '#007bff',
        strokeWidth: 2,
        strokeDashArray: [8, 4],
        strokeLineCap: 'square', // Like FPD
        originX: 'left', // Like FPD
        originY: 'top', // Like FPD
        selectable: false,
        evented: false,
        excludeFromExport: true,
        visible: true, // Explicitly set visible
        name: 'printArea'
      });

      console.log('📐 Print area rectangle created:', {
        left: printAreaRect.left,
        top: printAreaRect.top,
        width: printAreaRect.width,
        height: printAreaRect.height,
        fill: printAreaRect.fill,
        stroke: printAreaRect.stroke,
        visible: printAreaRect.visible
      });

      console.log('➕ Adding print area to canvas');
      fabricCanvas.add(printAreaRect);
      
      // Ensure print area is visible and properly layered
      fabricCanvas.bringToFront(printAreaRect);
      
      console.log('🔄 Rendering canvas...');
      // Only render if canvas is properly initialized
      try {
        if (fabricCanvas && !fabricCanvas.disposed && fabricCanvas.contextContainer) {
          fabricCanvas.renderAll();
          console.log('✅ Canvas rendered successfully');
        } else {
          console.warn('⚠️ Cannot render print area: canvas not ready');
        }
      } catch (error) {
        console.error('Error rendering print area:', error);
      }
      
    } catch (error) {
      console.error('❌ Error in renderPrintArea:', error);
    }
  };

  // Update product image and print area when selectedPrintArea or color changes
  useEffect(() => {
    console.log('🔄 Print area/color update effect triggered:', {
      hasCanvas: !!canvas,
      hasProduct: !!selectedProduct,
      selectedPrintArea,
      selectedColors,
      canvasReady: !!(canvas?.contextContainer)
    });

    if (canvas && selectedProduct && selectedColors.length > 0) {
      // Reset the rendered flag when switching print areas or colors
      canvas.__productRendered = false;
      
      if (canvas.contextContainer) {
        console.log('🎯 Canvas ready - updating product image and print area immediately');
        loadProductImage(canvas);
        renderPrintArea(canvas);
        canvas.__productRendered = true;
      } else {
        console.log('🎯 Canvas not ready - will update when ready');
        // Canvas will render via the main after:render handler
      }
    }
  }, [selectedPrintArea, selectedProduct, selectedColors]);

  // Add artwork to Fabric.js canvas
  const addArtworkToCanvas = (artworkUrl, displayWidth, displayHeight) => {
    if (!canvas || !selectedProduct) {
      console.warn('⚠️ Cannot add artwork: canvas or product missing');
      return;
    }
    
    if (canvas.disposed) {
      console.warn('⚠️ Cannot add artwork: canvas is disposed');
      return;
    }

    const printArea = selectedProduct.printAreas[selectedPrintArea];
    if (!printArea) return;

    // Remove existing artwork
    const existingArtwork = canvas.getObjects().find(obj => obj.name === 'artwork');
    if (existingArtwork) {
      canvas.remove(existingArtwork);
    }

    // Create Fabric.js image from URL
    fabric.Image.fromURL(artworkUrl, (img) => {
      // Calculate print area dimensions with inches to pixels conversion
      const toPx = (inch, dpi = printArea.maxDpi || 300) => inch * dpi;
      const printAreaWidth = printArea.width ?? (printArea.maxWidth ? toPx(printArea.maxWidth) : 0);
      const printAreaHeight = printArea.height ?? (printArea.maxHeight ? toPx(printArea.maxHeight) : 0);
      
      // Calculate position (center in print area)
      const printAreaX = printArea.x_position || printArea.x || 0;
      const printAreaY = printArea.y_position || printArea.y || 0;
      const centerX = printAreaX + (printAreaWidth - displayWidth) / 2;
      const centerY = printAreaY + (printAreaHeight - displayHeight) / 2;

      img.set({
        left: centerX,
        top: centerY,
        scaleX: displayWidth / img.width,
        scaleY: displayHeight / img.height,
        name: 'artwork',
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true
      });

      // Add event listeners for artwork movement
      img.on('moving', () => {
        updateArtworkPositionState(img);
        checkArtworkBounds(img);
      });

      img.on('scaling', () => {
        updateArtworkPositionState(img);
        checkArtworkBounds(img);
      });

      img.on('rotating', () => {
        updateArtworkPositionState(img);
      });

      canvas.add(img);
      
      // Ensure print area stays visible as a guide (on top but non-interactive)
      const printAreaObj = canvas.getObjects().find(obj => obj.name === 'printArea');
      if (printAreaObj) {
        canvas.bringToFront(printAreaObj);
      }
      
      canvas.setActiveObject(img);
      
      // Only render if canvas is properly initialized
      try {
        if (canvas && !canvas.disposed && canvas.contextContainer) {
          canvas.renderAll();
        } else {
          console.warn('⚠️ Cannot render canvas: canvas not ready');
        }
      } catch (error) {
        console.error('Error rendering canvas after adding artwork:', error);
      }
    }, { crossOrigin: 'anonymous' });
  };

  // Update artwork position state from canvas object
  const updateArtworkPositionState = (artworkObj) => {
    if (!selectedProduct) return;
    
    const printArea = selectedProduct.printAreas[selectedPrintArea];
    const printAreaX = printArea.x_position || printArea.x || 0;
    const printAreaY = printArea.y_position || printArea.y || 0;
    
    // Convert canvas position to relative position within print area
    const relativeX = artworkObj.left - printAreaX;
    const relativeY = artworkObj.top - printAreaY;
    
    setArtworkPosition({ x: relativeX, y: relativeY });
    setArtworkScale(artworkObj.scaleX); // Assuming uniform scaling
  };

  // Check if artwork is outside print area bounds
  const checkArtworkBounds = (artworkObj) => {
    if (!selectedProduct) return;

    const printArea = selectedProduct.printAreas[selectedPrintArea];
    const printAreaX = printArea.x_position || printArea.x || 0;
    const printAreaY = printArea.y_position || printArea.y || 0;
    
    const artworkBounds = artworkObj.getBoundingRect();
    const printBounds = {
      left: printAreaX,
      top: printAreaY,
      right: printAreaX + printArea.width,
      bottom: printAreaY + printArea.height
    };

    const isOutside = artworkBounds.left < printBounds.left ||
                     artworkBounds.top < printBounds.top ||
                     artworkBounds.left + artworkBounds.width > printBounds.right ||
                     artworkBounds.top + artworkBounds.height > printBounds.bottom;

    setIsArtworkOutsidePrintArea(isOutside);
  };

  // Load artwork for editing after product is selected
  const loadEditArtwork = async (artworkConfig, baseProduct) => {
    const originalArtworkUrl = artworkConfig.printFileUrl || editingProduct?.print_file_url;
    if (!originalArtworkUrl) return;

    // Create image element to load the artwork for canvas display
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate proper display dimensions if not saved
      let displayWidth = artworkConfig.displayWidth;
      let displayHeight = artworkConfig.displayHeight;
      
      // If display dimensions weren't saved, calculate them based on print area
      if (!displayWidth || !displayHeight) {
        const printArea = baseProduct?.printAreas?.[selectedPrintArea];
        if (printArea) {
          const printDPI = printArea.max_dpi || 300;
          const printWidthPixels = (printArea.max_width_inches || 12) * printDPI;
          const printHeightPixels = (printArea.max_height_inches || 16) * printDPI;
          
          const canvasToActualScaleX = printArea.width / printWidthPixels;
          const canvasToActualScaleY = printArea.height / printHeightPixels;
          
          displayWidth = img.width * canvasToActualScaleX;
          displayHeight = img.height * canvasToActualScaleY;
          
          // Ensure artwork doesn't exceed canvas bounds
          const maxCanvasWidth = printArea.width * 0.95;
          const maxCanvasHeight = printArea.height * 0.95;
          
          if (displayWidth > maxCanvasWidth) {
            displayHeight = (displayHeight * maxCanvasWidth) / displayWidth;
            displayWidth = maxCanvasWidth;
          }
          if (displayHeight > maxCanvasHeight) {
            displayWidth = (displayWidth * maxCanvasHeight) / displayHeight;
            displayHeight = maxCanvasHeight;
          }
        } else {
          // Fallback if no print area info
          displayWidth = img.width * 0.3;
          displayHeight = img.height * 0.3;
        }
      }

      setArtwork({
        artworkUrl: originalArtworkUrl,
        originalWidth: artworkConfig.width || img.width,
        originalHeight: artworkConfig.height || img.height,
        rotation: artworkConfig.rotation || 0,
        image: img, // Required for canvas display
        displayWidth: displayWidth,
        displayHeight: displayHeight
      });
    };
    img.onerror = (error) => {
      console.error('Failed to load artwork image for editing:', error);
      setError('Failed to load artwork image for editing');
    };
    img.src = originalArtworkUrl;
  };

  // Load existing product for editing
  const loadEditProduct = async () => {
    if (!editProductId) return;
    
    try {
      setIsLoadingEditProduct(true);
      const API_BASE_URL = import.meta.env.PROD ? 'https://pod-backend-yjyb.onrender.com' : 'http://localhost:3000';
      const response = await fetch(`${API_BASE_URL}/api/admin/client-products/${editProductId}`, {
        headers: {
          'Authorization': `Bearer ${apiService.shopToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const product = await response.json();
        setEditingProduct(product);
        
        // Populate form fields with existing data
        setProductTitle(product.title || '');
        setProductDescription(product.description || '');
        
        // Parse and restore artwork configuration
        if (product.artwork_config) {
          const artworkConfig = typeof product.artwork_config === 'string' 
            ? JSON.parse(product.artwork_config) 
            : product.artwork_config;
          
          if (artworkConfig) {
            setArtworkPosition({ x: artworkConfig.x || 0, y: artworkConfig.y || 0 });
            setArtworkScale(artworkConfig.scale || 1);
            
            // Store artwork config for later loading when product is selected
            window.pendingArtworkConfig = artworkConfig;
            
            // Restore selected variants if available
            if (artworkConfig.selectedVariants && artworkConfig.selectedVariants.length > 0) {
              const variants = artworkConfig.selectedVariants;
              const colors = [...new Set(variants.map(v => v.color))];
              const sizes = [...new Set(variants.map(v => v.size))];
              
              setSelectedColors(colors);
              setSelectedSizes(sizes);
              setSelectedVariants(variants);
              
              // Set primary color if it was stored
              if (colors.length > 0) {
                setPrimaryColor(colors[0]); // First color as fallback, will be updated by primary color logic if stored
              }
            }
          }
        }
        
        console.log('Loaded product for editing:', product);
      } else {
        setError('Failed to load product for editing');
      }
    } catch (error) {
      console.error('Error loading product for editing:', error);
      setError('Error loading product for editing');
    } finally {
      setIsLoadingEditProduct(false);
    }
  };

  // Load products from API
  useEffect(() => {
    const initializeComponent = async () => {
      await loadProducts();
      if (isEditMode) {
        await loadEditProduct();
      }
    };
    
    initializeComponent();
  }, [editProductId]);
  
  // Update selected product after both products and editing product are loaded
  useEffect(() => {
    if (editingProduct && products.length > 0) {
      const baseProduct = products.find(p => p.id === editingProduct.base_product_id);
      if (baseProduct) {
        setSelectedProduct(baseProduct);
        setSelectedVariant(baseProduct.variants?.[0] || null);
        
        // Initialize color availability check
        apiService.getColorAvailability(baseProduct.id).then(availability => {
          if (availability) {
            setColorAvailability(availability.colorAvailability);
          }
        }).catch(error => {
          console.error('Failed to fetch color availability:', error);
        });

        // Load artwork if we have pending artwork config
        if (window.pendingArtworkConfig) {
          loadEditArtwork(window.pendingArtworkConfig, baseProduct);
          window.pendingArtworkConfig = null; // Clear after using
        }
      }
    }
  }, [editingProduct, products, selectedPrintArea]);

  // Helper functions for variant selection
  const getUniqueColors = (variants) => {
    const colors = [...new Set(variants?.map(v => v.color) || [])];
    return colors;
  };

  const getUniqueSizes = (variants) => {
    const sizes = [...new Set(variants?.map(v => v.size) || [])];
    // Sort sizes in logical order
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
    return sizes.sort((a, b) => {
      const aIndex = sizeOrder.indexOf(a);
      const bIndex = sizeOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  };

  const initializeVariantSelections = (product) => {
    if (!product?.variants) return;
    
    const colors = getUniqueColors(product.variants);
    const sizes = getUniqueSizes(product.variants);
    
    // Default: first color, all sizes
    const defaultColors = colors.length > 0 ? [colors[0]] : [];
    const defaultSizes = sizes;
    
    setSelectedColors(defaultColors);
    setSelectedSizes(defaultSizes);
    updateSelectedVariants(product.variants, defaultColors, defaultSizes);
  };

  const updateSelectedVariants = (allVariants, colors, sizes) => {
    console.log('=== UPDATE SELECTED VARIANTS ===');
    console.log('colors:', colors);
    console.log('sizes:', sizes);
    console.log('allVariants:', allVariants?.length);
    
    const variants = allVariants.filter(variant => 
      colors.includes(variant.color) && sizes.includes(variant.size)
    );
    
    console.log('filtered variants:', variants?.length);
    console.log('filtered variants details:', variants);
    setSelectedVariants(variants);
  };

  // Color selection handlers
  const toggleColor = (color) => {
    // Don't allow selection of unavailable colors
    if (colorAvailability[color] === false) {
      return;
    }
    
    const newColors = selectedColors.includes(color)
      ? selectedColors.filter(c => c !== color)
      : [...selectedColors, color];
    setSelectedColors(newColors);
    updateSelectedVariants(selectedProduct.variants, newColors, selectedSizes);
    
    // If this is the first color selected, make it primary
    if (newColors.length === 1 && !primaryColor) {
      setPrimaryColor(color);
    }
    
    // If we're deselecting the primary color, set a new primary from remaining colors
    if (!newColors.includes(primaryColor) && newColors.length > 0) {
      setPrimaryColor(newColors[0]);
    }
    
    // If no colors selected, clear primary
    if (newColors.length === 0) {
      setPrimaryColor(null);
    }
    
    // Update preview variant to match selected color
    if (newColors.length > 0) {
      const previewVariant = selectedProduct.variants.find(v => v.color === newColors[0]);
      if (previewVariant) setSelectedVariant(previewVariant);
    }
  };

  // Set primary color (main product image for Shopify)
  const setPrimaryColorHandler = (color) => {
    // Only allow setting primary if color is selected and available
    if (selectedColors.includes(color) && colorAvailability[color] !== false) {
      setPrimaryColor(color);
      setIsSelectingPrimary(false); // Exit selection mode
    }
  };

  // Handle color swatch click - either toggle selection or set primary
  const handleColorClick = (color) => {
    if (colorAvailability[color] === false) {
      return; // Don't allow unavailable colors
    }

    if (isSelectingPrimary) {
      // In primary selection mode, only set primary if color is selected
      if (selectedColors.includes(color)) {
        setPrimaryColorHandler(color);
      }
    } else {
      // Normal mode - toggle color selection
      toggleColor(color);
    }
  };

  // Get the variant that should be displayed in the editor
  const getDisplayVariant = () => {
    if (!selectedProduct) return null;
    
    // Priority: hover color > primary color > first selected color > first variant
    let targetColor = hoverColor || primaryColor || selectedColors[0];
    
    if (!targetColor) {
      return selectedVariant || selectedProduct.variants?.[0] || null;
    }
    
    // Find a variant with the target color
    const variant = selectedProduct.variants.find(v => v.color === targetColor);
    return variant || selectedVariant || selectedProduct.variants?.[0] || null;
  };

  const selectAllColors = () => {
    const allColors = getUniqueColors(selectedProduct.variants);
    // Only select available colors
    const availableColors = allColors.filter(color => colorAvailability[color] !== false);
    setSelectedColors(availableColors);
    updateSelectedVariants(selectedProduct.variants, availableColors, selectedSizes);
    
    // Set first available color as primary if none is set, or if current primary is not in available colors
    if (availableColors.length > 0 && (!primaryColor || !availableColors.includes(primaryColor))) {
      setPrimaryColor(availableColors[0]);
    }
    
    // Update preview to first available color
    if (availableColors.length > 0) {
      const previewVariant = selectedProduct.variants.find(v => v.color === availableColors[0]);
      if (previewVariant) setSelectedVariant(previewVariant);
    }
  };

  const deselectAllColors = () => {
    setSelectedColors([]);
    setPrimaryColor(null);
    updateSelectedVariants(selectedProduct.variants, [], selectedSizes);
  };

  // Size selection handlers
  const toggleSize = (size) => {
    const newSizes = selectedSizes.includes(size)
      ? selectedSizes.filter(s => s !== size)
      : [...selectedSizes, size];
    setSelectedSizes(newSizes);
    updateSelectedVariants(selectedProduct.variants, selectedColors, newSizes);
  };

  // Color mapping for swatches
  const getColorHex = (colorName) => {
    const colorMap = {
      'Black': '#000000',
      'White': '#FFFFFF', 
      'Navy': '#000080',
      'Red': '#FF0000',
      'Blue': '#0000FF',
      'Green': '#008000',
      'Yellow': '#FFFF00',
      'Pink': '#FFC0CB',
      'Purple': '#800080',
      'Orange': '#FFA500',
      'Gray': '#808080',
      'Grey': '#808080',
      'Brown': '#A52A2A',
      'Maroon': '#800000',
      'Teal': '#008080',
      'Lime': '#00FF00'
    };
    return colorMap[colorName] || '#CCCCCC';
  };

  const loadProducts = async () => {
    try {
      setIsLoadingProducts(true);
      setError(null);
      const productsData = await apiService.getProducts();
      console.log('🔍 Products loaded:', productsData);
      setProducts(productsData);
      
      if (productsData.length > 0) {
        console.log('🔍 Selected product:', productsData[0]);
        console.log('🔍 Print areas:', productsData[0].printAreas);
        const product = productsData[0];
        setSelectedProduct(product);
        setSelectedVariant(product.variants?.[0] || null);
        setProductTitle(product.title);
        setProductDescription(product.description);
        
        // Initialize variant selections with defaults
        initializeVariantSelections(product);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      setError('Failed to load products. Please check your connection and try again.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Old HTML5 canvas initialization removed - now using Fabric.js

  // Old HTML5 canvas drawing function removed - now handled by Fabric.js

  // Old HTML5 canvas mouse handlers removed - now handled by Fabric.js

  // Old HTML5 canvas interaction functions removed - now handled by Fabric.js

  // Reset artwork position and scale
  const resetArtworkTransform = () => {
    if (!canvas) return;
    
    const artworkObj = canvas.getObjects().find(obj => obj.name === 'artwork');
    if (!artworkObj || !selectedProduct) return;

    const printArea = selectedProduct.printAreas[selectedPrintArea];
    const printAreaX = printArea.x_position || printArea.x || 0;
    const printAreaY = printArea.y_position || printArea.y || 0;
    
    // Calculate print area dimensions with inches to pixels conversion
    const toPx = (inch, dpi = printArea.maxDpi || 300) => inch * dpi;
    const printAreaWidth = printArea.width ?? (printArea.maxWidth ? toPx(printArea.maxWidth) : 0);
    const printAreaHeight = printArea.height ?? (printArea.maxHeight ? toPx(printArea.maxHeight) : 0);
    
    // Reset to center position with original scale
    const centerX = printAreaX + (printAreaWidth - artwork.displayWidth) / 2;
    const centerY = printAreaY + (printAreaHeight - artwork.displayHeight) / 2;
    
    artworkObj.set({
      left: centerX,
      top: centerY,
      scaleX: artwork.displayWidth / artwork.originalWidth,
      scaleY: artwork.displayHeight / artwork.originalHeight
    });
    
    try {
      canvas.renderAll();
    } catch (error) {
      console.error('Error rendering canvas in resetArtworkTransform:', error);
    }
    updateArtworkPositionState(artworkObj);
  };

  // Auto-fit artwork to print area
  const autoFitArtwork = () => {
    if (!canvas || !artwork || !selectedProduct?.printAreas?.[selectedPrintArea]) return;

    const artworkObj = canvas.getObjects().find(obj => obj.name === 'artwork');
    if (!artworkObj) return;

    const printArea = selectedProduct.printAreas[selectedPrintArea];
    const printAreaX = printArea.x_position || printArea.x || 0;
    const printAreaY = printArea.y_position || printArea.y || 0;

    // Calculate print area dimensions with inches to pixels conversion
    const toPx = (inch, dpi = printArea.maxDpi || 300) => inch * dpi;
    const printAreaWidth = printArea.width ?? (printArea.maxWidth ? toPx(printArea.maxWidth) : 0);
    const printAreaHeight = printArea.height ?? (printArea.maxHeight ? toPx(printArea.maxHeight) : 0);

    // Calculate scale to fit artwork within print area (maintain aspect ratio)
    const scaleX = (printAreaWidth * 0.95) / artwork.originalWidth;
    const scaleY = (printAreaHeight * 0.95) / artwork.originalHeight;
    const fitScale = Math.min(scaleX, scaleY);

    // Center the artwork in print area
    const centerX = printAreaX + (printAreaWidth - artwork.originalWidth * fitScale) / 2;
    const centerY = printAreaY + (printAreaHeight - artwork.originalHeight * fitScale) / 2;

    artworkObj.set({
      left: centerX,
      top: centerY,
      scaleX: fitScale,
      scaleY: fitScale
    });

    try {
      canvas.renderAll();
    } catch (error) {
      console.error('Error rendering canvas in autoFitArtwork:', error);
    }
    updateArtworkPositionState(artworkObj);
    checkArtworkBounds(artworkObj);
  };

  // Auto-center artwork in print area
  const centerArtwork = () => {
    if (!canvas || !artwork || !selectedProduct) return;
    
    const artworkObj = canvas.getObjects().find(obj => obj.name === 'artwork');
    if (!artworkObj) return;

    const printArea = selectedProduct.printAreas[selectedPrintArea];
    const printAreaX = printArea.x_position || printArea.x || 0;
    const printAreaY = printArea.y_position || printArea.y || 0;
    
    // Calculate print area dimensions with inches to pixels conversion
    const toPx = (inch, dpi = printArea.maxDpi || 300) => inch * dpi;
    const printAreaWidth = printArea.width ?? (printArea.maxWidth ? toPx(printArea.maxWidth) : 0);
    const printAreaHeight = printArea.height ?? (printArea.maxHeight ? toPx(printArea.maxHeight) : 0);
    
    // Center position, keeping current scale
    const centerX = printAreaX + (printAreaWidth - artworkObj.getScaledWidth()) / 2;
    const centerY = printAreaY + (printAreaHeight - artworkObj.getScaledHeight()) / 2;
    
    artworkObj.set({
      left: centerX,
      top: centerY
    });
    
    try {
      canvas.renderAll();
    } catch (error) {
      console.error('Error rendering canvas in centerArtwork:', error);
    }
    updateArtworkPositionState(artworkObj);
    checkArtworkBounds(artworkObj);
  };

  // Smart resize to fit within bounds while maintaining current position
  const smartResize = () => {
    if (!artwork || !selectedProduct?.printAreas?.[selectedPrintArea]) return;

    const printArea = selectedProduct.printAreas[selectedPrintArea];
    const scaledPrintX = printArea.x_position || printArea.x;
    const scaledPrintY = printArea.y_position || printArea.y;
    const scaledPrintWidth = printArea.width;
    const scaledPrintHeight = printArea.height;

    // Calculate current artwork bounds
    const baseX = scaledPrintX + (scaledPrintWidth - artwork.displayWidth * artworkScale) / 2;
    const baseY = scaledPrintY + (scaledPrintHeight - artwork.displayHeight * artworkScale) / 2;
    const artworkX = baseX + artworkPosition.x;
    const artworkY = baseY + artworkPosition.y;
    
    const scaledWidth = artwork.displayWidth * artworkScale;
    const scaledHeight = artwork.displayHeight * artworkScale;

    // Calculate required scale to fit current position within bounds
    let newScale = artworkScale;
    
    // Check horizontal bounds
    if (artworkX < scaledPrintX || artworkX + scaledWidth > scaledPrintX + scaledPrintWidth) {
      const availableWidth = scaledPrintWidth - Math.abs(artworkPosition.x) * 2;
      const scaleX = availableWidth / artwork.displayWidth;
      newScale = Math.min(newScale, scaleX);
    }
    
    // Check vertical bounds
    if (artworkY < scaledPrintY || artworkY + scaledHeight > scaledPrintY + scaledPrintHeight) {
      const availableHeight = scaledPrintHeight - Math.abs(artworkPosition.y) * 2;
      const scaleY = availableHeight / artwork.displayHeight;
      newScale = Math.min(newScale, scaleY);
    }

    setArtworkScale(Math.max(0.1, newScale * 0.95)); // Minimum scale and slight margin
  };

  // Duplicate checkArtworkBounds function removed - using the Fabric.js version above

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Upload artwork to server
      const uploadResult = await apiService.uploadArtwork(file);
      
      // Also create local preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const printArea = selectedProduct.printAreas[selectedPrintArea];
          
          // Calculate actual print dimensions in pixels at print DPI
          const printDPI = printArea.max_dpi || 300;
          const printWidthPixels = (printArea.max_width_inches || 12) * printDPI;
          const printHeightPixels = (printArea.max_height_inches || 16) * printDPI;
          
          // Calculate scale factor to show artwork at actual size relative to print area
          // Canvas print area is printArea.width x printArea.height pixels
          // Actual print area is printWidthPixels x printHeightPixels at DPI
          const canvasToActualScaleX = printArea.width / printWidthPixels;
          const canvasToActualScaleY = printArea.height / printHeightPixels;
          
          // Display artwork at actual size relative to print area
          let displayWidth = img.width * canvasToActualScaleX;
          let displayHeight = img.height * canvasToActualScaleY;
          
          // Ensure artwork doesn't exceed canvas bounds (safety check)
          const maxCanvasWidth = printArea.width * 0.95;
          const maxCanvasHeight = printArea.height * 0.95;
          
          if (displayWidth > maxCanvasWidth) {
            displayHeight = (displayHeight * maxCanvasWidth) / displayWidth;
            displayWidth = maxCanvasWidth;
          }
          if (displayHeight > maxCanvasHeight) {
            displayWidth = (displayWidth * maxCanvasHeight) / displayHeight;
            displayHeight = maxCanvasHeight;
          }

          setArtwork({
            file,
            image: img,
            originalWidth: img.width,
            originalHeight: img.height,
            displayWidth,
            displayHeight,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            artworkUrl: uploadResult.artworkUrl,
            publicId: uploadResult.publicId
          });

          // Add artwork to Fabric.js canvas
          addArtworkToCanvas(uploadResult.artworkUrl, displayWidth, displayHeight);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload artwork:', error);
      setError('Failed to upload artwork. Please try again.');
    }
  };

  const generateMockup = async () => {
    if (!canvas || !artwork || !selectedProduct || !selectedVariant) {
      return;
    }

    setIsGeneratingMockup(true);
    
    try {
      const printArea = selectedProduct.printAreas[selectedPrintArea];
      
      // Get artwork data from Fabric.js canvas
      const artworkObj = canvas.getObjects().find(obj => obj.name === 'artwork');
      if (!artworkObj) {
        throw new Error('No artwork found on canvas');
      }

      // Calculate relative position from canvas coordinates
      const printAreaX = printArea.x_position || printArea.x || 0;
      const printAreaY = printArea.y_position || printArea.y || 0;
      const relativeX = artworkObj.left - printAreaX;
      const relativeY = artworkObj.top - printAreaY;

      const mockupData = {
        productId: selectedProduct.id,
        variantId: selectedVariant.id,
        printAreaId: printArea.id,
        artworkUrl: artwork.artworkUrl,
        artworkConfig: {
          x: relativeX,
          y: relativeY,
          width: artwork.originalWidth,
          height: artwork.originalHeight,
          scale: artworkObj.scaleX, // Use actual scale from canvas
          rotation: artworkObj.angle || 0,
          displayWidth: artwork.displayWidth,
          displayHeight: artwork.displayHeight
        }
      };

      const result = await apiService.generateMockup(mockupData);
      console.log('Mockup generated:', result.mockupUrl);
      
      // Update artwork with mockup URL
      setArtwork(prev => ({
        ...prev,
        mockupUrl: result.mockupUrl
      }));
      
    } catch (error) {
      console.error('Error generating mockup:', error);
      setError('Failed to generate mockup. Please try again.');
    } finally {
      setIsGeneratingMockup(false);
    }
  };

  // Generate print file using main Fabric.js canvas with multiplier approach
  const generatePrintFile = async () => {
    if (!canvas || !artwork || !selectedProduct) {
      throw new Error('Missing canvas, artwork, or product data for print file generation');
    }

    const printArea = selectedProduct.printAreas[selectedPrintArea];
    if (!printArea) {
      throw new Error('No print area selected');
    }

    // Calculate print file dimensions at 300 DPI
    const printDPI = 300;
    const printWidthPixels = Math.round((printArea.max_width_inches || printArea.maxWidthInches) * printDPI);
    const printHeightPixels = Math.round((printArea.max_height_inches || printArea.maxHeightInches) * printDPI);
    
    // Calculate multiplier for high-resolution export
    const printAreaCanvasWidth = printArea.width;
    const multiplier = printWidthPixels / printAreaCanvasWidth;
    
    console.log('Print file generation parameters:', {
      printDimensions: `${printWidthPixels}x${printHeightPixels}`,
      printAreaCanvas: `${printArea.width}x${printArea.height}`,
      multiplier: multiplier.toFixed(2)
    });

    // Create temporary canvas for print area only
    const printCanvas = new fabric.Canvas(null, {
      width: printArea.width,
      height: printArea.height,
      backgroundColor: 'transparent'
    });

    // Clone artwork from main canvas
    const artworkObj = canvas.getObjects().find(obj => obj.name === 'artwork');
    if (!artworkObj) {
      throw new Error('No artwork found on canvas');
    }

    const clonedArtwork = await new Promise((resolve) => {
      artworkObj.clone((cloned) => {
        // Adjust position relative to print area
        const printAreaX = printArea.x_position || printArea.x || 0;
        const printAreaY = printArea.y_position || printArea.y || 0;
        
        cloned.set({
          left: cloned.left - printAreaX,
          top: cloned.top - printAreaY
        });
        
        resolve(cloned);
      });
    });

    printCanvas.add(clonedArtwork);
    
    try {
      printCanvas.renderAll();
    } catch (error) {
      console.error('Error rendering print canvas:', error);
      throw error;
    }

    // Export at high resolution using multiplier
    const printDataURL = printCanvas.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: multiplier,
      backgroundColor: 'transparent'
    });

    // Convert data URL to blob for upload (using Fabric.js utility for better performance)
    const blob = fabric.util.dataURLToBlob(printDataURL);

    // Upload to backend
    const formData = new FormData();
    formData.append('file', blob, `print_file_${Date.now()}.png`);

    const uploadResponse = await apiService.uploadArtwork(formData);
    
    // Clean up temporary canvas
    printCanvas.dispose();
    
    return uploadResponse.url;
  };

  const createShopifyProduct = async () => {
    if (!productTitle.trim() || !artwork || selectedVariants.length === 0) {
      return;
    }

    setIsCreatingProduct(true);
    
    try {
      const printArea = selectedProduct.printAreas[selectedPrintArea];
      
      // Debug logging
      console.log('=== CREATE SHOPIFY PRODUCT DEBUG ===');
      console.log('selectedColors:', selectedColors);
      console.log('selectedSizes:', selectedSizes);
      console.log('selectedVariants:', selectedVariants);
      console.log('selectedVariants.length:', selectedVariants.length);
      
      // Generate mockups for all selected colors
      const uniqueColors = [...new Set(selectedVariants.map(v => v.color))];
      const colorMockups = {};
      
      console.log('uniqueColors:', uniqueColors);
      console.log(`Generating mockups for ${uniqueColors.length} colors...`);
      
      // Generate print file using Fabric.js (like FancyProductDesigner)
      let printFileUrl = null;
      if (canvas && artwork) {
        console.log('Generating print file using Fabric.js...');
        try {
          printFileUrl = await generatePrintFile();
          console.log('Print file generated successfully:', printFileUrl);
        } catch (error) {
          console.error('Failed to generate print file:', error);
          // Continue without print file - this is not a blocking error
        }
      }
      
      for (const color of uniqueColors) {
        // Skip unavailable colors
        if (colorAvailability[color] === false) {
          console.log(`Skipping ${color} - color not available`);
          continue;
        }
        
        // Find a variant with this color
        const colorVariant = selectedVariants.find(v => v.color === color);
        
        if (colorVariant) {
          console.log(`Generating mockup for ${color}...`);
          
          try {
            const mockupData = {
              productId: selectedProduct.id,
              variantId: colorVariant.id,
              printAreaId: printArea.id,
              artworkUrl: artwork.artworkUrl,
              artworkConfig: {
                x: artworkPosition.x,
                y: artworkPosition.y,
                width: artwork.originalWidth,
                height: artwork.originalHeight,
                scale: artworkScale,
                rotation: artwork.rotation || 0
              }
            };

            const mockupResult = await apiService.generateMockup(mockupData);
            colorMockups[color] = mockupResult.mockupUrl;
            console.log(`Mockup generated for ${color}:`, mockupResult.mockupUrl);
          } catch (mockupError) {
            console.error(`Failed to generate mockup for ${color}:`, mockupError);
            // If this color fails, we'll skip it and continue with others
            // Don't add to colorMockups so the product creation knows it's missing
          }
        }
      }
      
      const productData = {
        title: productTitle,
        description: productDescription,
        baseProductId: selectedProduct.id,
        selectedVariants: selectedVariants.map(variant => ({
          id: variant.id,
          size: variant.size,
          color: variant.color,
          sku: variant.sku,
          price_modifier: variant.price_modifier || 0
        })),
        colorMockups: colorMockups,  // Send all color mockups
        primaryColor: primaryColor,  // Primary color for Shopify product ordering
        artworkConfig: {
          x: artworkPosition.x,
          y: artworkPosition.y,
          width: artwork.originalWidth,
          height: artwork.originalHeight,
          scale: artworkScale,
          rotation: artwork.rotation || 0,
          displayWidth: artwork.displayWidth,  // Canvas display dimensions
          displayHeight: artwork.displayHeight,
          artworkUrl: artwork.artworkUrl  // Required for backend print file generation
        },
        printFileUrl: printFileUrl, // Generated on frontend using Fabric.js
        basePrice: selectedProduct.basePrice
      };

      // Call appropriate API based on mode
      const result = isEditMode 
        ? await apiService.updateShopifyProduct(editProductId, productData)
        : await apiService.createShopifyProduct(productData);
      console.log(`Shopify product ${isEditMode ? 'updated' : 'created'}:`, result);
      
      // Clear any previous errors
      setError(null);
      
      // Show success message for production mode
      setSuccessMessage({
        type: 'success',
        title: isEditMode ? 'Product Updated Successfully!' : 'Product Created Successfully!',
        message: result.message,
        note: result.note,
        productData: {
          title: productTitle,
          id: result.shopifyProduct.id,
          variantCount: selectedVariants.length,
          colors: selectedColors,
          sizes: selectedSizes,
          basePrice: productData.basePrice
        }
      });
      
      // Auto-clear success message after 10 seconds
      setTimeout(() => setSuccessMessage(null), 10000);
      
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} product:`, error);
      setError(`Failed to ${isEditMode ? 'update' : 'create'} Shopify product. Please try again.`);
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const productOptions = products.map(product => ({
    label: product.title,
    value: product.id.toString()
  }));

  if (isLoadingProducts || isLoadingEditProduct) {
    return (
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spinner size="large" />
              <p style={{ marginTop: '1rem' }}>
                {isLoadingEditProduct ? 'Loading product for editing...' : 'Loading products...'}
              </p>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Layout.Section>
          <Banner status="critical" title="Error">
            {error}
            <div style={{ marginTop: '1rem' }}>
              <Button onClick={loadProducts}>Retry</Button>
            </div>
          </Banner>
        </Layout.Section>
      </Layout>
    );
  }

  console.log('🖥️ ProductDecorator render:', {
    hasCanvas: !!canvas,
    hasCanvasRef: !!canvasRef.current,
    hasSelectedProduct: !!selectedProduct,
    selectedPrintArea,
    isLoadingProducts,
    isLoadingEditProduct,
    hasError: !!error,
    canvasObjects: canvas ? canvas.getObjects().length : 0,
    printAreaRendered: canvas ? canvas.__printAreaRendered : false,
    fabricAvailable: !!fabric,
    fabricCanvasAvailable: !!fabric?.Canvas
  });

  return (
    <Layout>
      {/* Edit Mode Banner */}
      {isEditMode && editingProduct && (
        <Layout.Section>
          <Banner 
            status="info"
            title={`Editing Product: ${editingProduct.title}`}
          >
            <p>You are editing an existing product. Make your changes and click "Update Product" to save.</p>
            <p><strong>Original Shopify ID:</strong> {editingProduct.shopify_product_id}</p>
          </Banner>
        </Layout.Section>
      )}
      
      {/* Success/Demo Message */}
      {successMessage && (
        <Layout.Section>
          <Banner 
            status="success"
            title={successMessage.title}
            onDismiss={() => setSuccessMessage(null)}
          >
            <div style={{ marginBottom: '1rem' }}>
              {successMessage.message}
            </div>
            
            {successMessage.note && (
              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: '#e8f5e8', 
                border: '1px solid #4caf50',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                <strong>Production Mode:</strong> {successMessage.note}
              </div>
            )}
            
            {successMessage.productData && (
              <div style={{ 
                fontSize: '0.875rem',
                color: '#637381'
              }}>
                <div><strong>Product:</strong> {successMessage.productData.title}</div>
                <div><strong>ID:</strong> {successMessage.productData.id}</div>
                <div><strong>Variants Created:</strong> {successMessage.productData.variantCount}</div>
                <div><strong>Colors:</strong> {successMessage.productData.colors?.join(', ')}</div>
                <div><strong>Sizes:</strong> {successMessage.productData.sizes?.join(', ')}</div>
                {successMessage.productData.basePrice && (
                  <div><strong>Base Price:</strong> ${successMessage.productData.basePrice}</div>
                )}
                {successMessage.productData.url && (
                  <div>
                    <a 
                      href={successMessage.productData.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#008060', textDecoration: 'underline' }}
                    >
                      View in Shopify Admin
                    </a>
                  </div>
                )}
              </div>
            )}
          </Banner>
        </Layout.Section>
      )}
      <Layout.Section oneThird>
        <LegacyStack vertical spacing="loose">
          {/* Product Selection */}
          <Card title="Select Product" sectioned>
            <LegacyStack vertical spacing="tight">
              <Select
                label="Product"
                options={productOptions}
                value={selectedProduct?.id.toString() || ''}
                onChange={async (value) => {
                  const product = products.find(p => p.id === parseInt(value));
                  setSelectedProduct(product);
                  setSelectedVariant(product?.variants?.[0] || null);
                  if (product) {
                    setProductTitle(product.title);
                    setProductDescription(product.description);
                    
                    // Check color availability for this product
                    try {
                      const availability = await apiService.getColorAvailability(product.id);
                      if (availability) {
                        setColorAvailability(availability.colorAvailability);
                        console.log('Color availability for product', product.id, ':', availability.colorAvailability);
                      } else {
                        // If we can't check availability, assume all colors are available
                        setColorAvailability({});
                      }
                    } catch (error) {
                      console.error('Failed to fetch color availability:', error);
                      setColorAvailability({});
                    }
                    
                    initializeVariantSelections(product);
                  }
                }}
              />
              
              {/* Color Selection */}
              {selectedProduct && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>Product Colors</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={selectAllColors}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#007bff', 
                          fontSize: '12px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Select all colors
                      </button>
                      <button 
                        onClick={deselectAllColors}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#007bff', 
                          fontSize: '12px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Deselect all colors
                      </button>
                    </div>
                  </div>
                  
                  {/* Color Swatches */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                    {getUniqueColors(selectedProduct.variants).map(color => {
                      const isAvailable = colorAvailability[color] !== false; // Available if true or undefined
                      const isSelected = selectedColors.includes(color);
                      const isPrimary = primaryColor === color;
                      
                      return (
                        <div
                          key={color}
                          style={{ 
                            position: 'relative',
                            display: 'inline-block'
                          }}
                        >
                          <button
                            onClick={() => handleColorClick(color)}
                            disabled={!isAvailable}
                            onMouseEnter={() => isAvailable ? setHoverColor(color) : null}
                            onMouseLeave={() => setHoverColor(null)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: getColorHex(color),
                              border: isPrimary ? '3px solid #FFD700' : 
                                     (isSelectingPrimary && isSelected) ? '3px solid #007bff' :
                                     isSelected ? '3px solid #007bff' : '2px solid #ddd',
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              position: 'relative',
                              boxShadow: isPrimary ? '0 0 8px rgba(255,215,0,0.5)' : 
                                        (isSelectingPrimary && isSelected && !isPrimary) ? '0 0 6px rgba(0,123,255,0.4)' :
                                        '0 2px 4px rgba(0,0,0,0.1)',
                              opacity: isAvailable ? 
                                      (isSelectingPrimary && !isSelected) ? 0.4 : 1 
                                      : 0.6,
                              transform: (isSelectingPrimary && isSelected && !isPrimary) ? 'scale(1.1)' : 'scale(1)',
                              transition: 'all 0.2s ease'
                            }}
                            title={
                              !isAvailable ? `${color} unavailable at the moment` :
                              isSelectingPrimary ? 
                                (isSelected ? `Tap to set ${color} as primary` : `${color} (not selected)`) :
                                (isPrimary ? `${color} (Primary)` : color)
                            }
                          >
                            {/* Primary color star */}
                            {isPrimary && (
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                color: '#FFD700',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                textShadow: '0 0 2px rgba(0,0,0,0.8)'
                              }}>
                                ★
                              </div>
                            )}
                            
                            {/* Selection checkmark for non-primary selected colors */}
                            {isSelected && isAvailable && !isPrimary && !isSelectingPrimary && (
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                color: color === 'White' ? '#000' : '#fff',
                                fontSize: '16px',
                                fontWeight: 'bold'
                              }}>
                                ✓
                              </div>
                            )}
                            
                            {/* Selection mode indicator for selectable colors */}
                            {isSelectingPrimary && isSelected && !isPrimary && (
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                color: '#007bff',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                textShadow: '0 0 2px rgba(255,255,255,0.8)'
                              }}>
                                👆
                              </div>
                            )}
                            
                            {/* Unavailable color slash */}
                            {!isAvailable && (
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%) rotate(45deg)',
                                width: '2px',
                                height: '28px',
                                backgroundColor: '#ff4444',
                                boxShadow: '0 0 0 1px #fff'
                              }} />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Primary Color Info */}
                  {primaryColor && (
                    <div style={{ 
                      marginBottom: '15px', 
                      padding: '8px 12px', 
                      backgroundColor: isSelectingPrimary ? '#E8F4FD' : '#FFF9E6', 
                      border: isSelectingPrimary ? '1px solid #007bff' : '1px solid #FFD700',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: isSelectingPrimary ? '#0066CC' : '#B8860B',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>
                        <span style={{ fontWeight: '500' }}>
                          {isSelectingPrimary ? '👆 Tap a selected color to set as primary' : `★ Primary Color: ${primaryColor}`}
                        </span>
                        {!isSelectingPrimary && ' (will be shown first in Shopify)'}
                      </span>
                      {!isSelectingPrimary ? (
                        <button
                          onClick={() => setIsSelectingPrimary(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#007bff',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '0',
                            marginLeft: '8px'
                          }}
                        >
                          change
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsSelectingPrimary(false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#666',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '0',
                            marginLeft: '8px'
                          }}
                        >
                          cancel
                        </button>
                      )}
                    </div>
                  )}

                  {/* Size Selection */}
                  <div>
                    <span style={{ fontWeight: '500', fontSize: '14px', marginBottom: '10px', display: 'block' }}>Product Sizes</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {getUniqueSizes(selectedProduct.variants).map(size => (
                        <button
                          key={size}
                          onClick={() => toggleSize(size)}
                          style={{
                            padding: '8px 16px',
                            border: selectedSizes.includes(size) ? '2px solid #007bff' : '2px solid #ddd',
                            backgroundColor: selectedSizes.includes(size) ? '#f0f8ff' : '#fff',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: selectedSizes.includes(size) ? '600' : '400',
                            color: selectedSizes.includes(size) ? '#007bff' : '#333',
                            position: 'relative',
                            minWidth: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {size}
                          {selectedSizes.includes(size) && (
                            <span style={{
                              position: 'absolute',
                              top: '2px',
                              right: '4px',
                              fontSize: '10px',
                              color: '#007bff'
                            }}>
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Variants Count */}
                  <div style={{ 
                    marginTop: '15px', 
                    padding: '10px', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#666'
                  }}>
                    <strong>{selectedVariants.length}</strong> variant{selectedVariants.length !== 1 ? 's' : ''} selected
                    {selectedVariants.length > 0 && (
                      <div style={{ marginTop: '5px', fontSize: '12px' }}>
                        Colors: {selectedColors.join(', ')} • Sizes: {selectedSizes.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </LegacyStack>
          </Card>

          {/* Print Area Selection */}
          <Card title="Print Area" sectioned>
            <ButtonGroup segmented>
              <Button
                pressed={selectedPrintArea === 'front'}
                onClick={() => setSelectedPrintArea('front')}
              >
                Front
              </Button>
              <Button
                pressed={selectedPrintArea === 'back'}
                onClick={() => setSelectedPrintArea('back')}
              >
                Back
              </Button>
            </ButtonGroup>
          </Card>

          {/* Artwork Upload */}
          <Card title="Upload Artwork" sectioned>
            <LegacyStack vertical spacing="tight">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <Button
                fullWidth
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Image
              </Button>
              {artwork && (
                <Banner status="success">
                  Artwork uploaded: {artwork.originalWidth}x{artwork.originalHeight}px
                </Banner>
              )}
            </LegacyStack>
          </Card>

          {/* Product Details */}
          <Card title="Product Details" sectioned>
            <LegacyStack vertical spacing="tight">
              <TextField
                label="Title"
                value={productTitle}
                onChange={setProductTitle}
                placeholder="Enter product title"
              />
              <TextField
                label="Description"
                value={productDescription}
                onChange={setProductDescription}
                multiline={3}
                placeholder="Enter product description"
              />
            </LegacyStack>
          </Card>
        </LegacyStack>
      </Layout.Section>

      <Layout.Section>
        <LegacyStack vertical spacing="loose">
          {/* Canvas */}
          <Card title="Design Preview" sectioned>
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <canvas
                ref={(el) => {
                  console.log('🎯 Canvas ref callback called:', { 
                    element: el, 
                    hasElement: !!el, 
                    hasCanvas: !!canvas,
                    currentRef: canvasRef.current,
                    elementInitialized: el?._fabricInitialized 
                  });
                  
                  // Handle cleanup when element is being unmounted
                  if (!el && canvasRef.current && canvas) {
                    console.log('🧹 Canvas element being unmounted, cleaning up');
                    try {
                      if (canvas && !canvas.disposed) {
                        canvas.dispose();
                      }
                      // Critical: Clear the cached references to prevent stale canvas reuse
                      delete canvasRef.current._fabricCanvas;
                      delete canvasRef.current._fabricInitialized;
                    } catch (error) {
                      console.error('Error disposing canvas in ref cleanup:', error);
                    }
                    setCanvas(null);
                  }
                  
                  canvasRef.current = el;
                  
                  // Trigger canvas initialization when element is mounted
                  if (el && !el._fabricInitialized) {
                    console.log('🎨 Canvas element mounted, initializing Fabric.js');
                    el._fabricInitialized = true; // Prevent double initialization
                    initializeCanvas(el);
                  }
                }}
                width={500}
                height={500}
                style={{ 
                  border: '1px solid #ddd',
                  maxWidth: '100%',
                  backgroundColor: '#f8f9fa',
                  display: 'block'
                }}
              />
              {!canvas && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#666',
                  fontSize: '14px',
                  pointerEvents: 'none'
                }}>
                  Initializing canvas... (Debug: canvas={canvas ? 'exists' : 'null'})
                </div>
              )}
              {canvas && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  color: '#007bff',
                  fontSize: '12px',
                  pointerEvents: 'none',
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  Canvas Ready ✅ (Objects: {canvas.getObjects().length})
                </div>
              )}
              
              {/* Enhanced Artwork boundary warning */}
              {isArtworkOutsidePrintArea && artwork && (
                <div style={{ 
                  marginTop: '10px', 
                  padding: '12px', 
                  backgroundColor: '#fff3cd', 
                  border: '1px solid #ffeaa7',
                  borderRadius: '6px',
                  color: '#856404',
                  fontSize: '13px',
                  maxWidth: '500px',
                  margin: '10px auto 0'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠️ Artwork Outside Print Area
                    <span style={{ 
                      fontSize: '10px', 
                      backgroundColor: '#856404', 
                      color: '#fff', 
                      padding: '2px 6px', 
                      borderRadius: '3px',
                      fontWeight: 'normal'
                    }}>
                      WILL BE CROPPED
                    </span>
                  </div>
                  <div style={{ marginBottom: '8px', lineHeight: '1.4' }}>
                    Red highlighted areas extend beyond the print boundaries and will be automatically cropped from the final product.
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontSize: '11px',
                    padding: '6px 8px',
                    backgroundColor: '#f8f5e3',
                    borderRadius: '4px',
                    marginTop: '8px'
                  }}>
                    <span style={{ fontWeight: '500' }}>
                      💡 Use Quick Fixes below to automatically adjust your artwork
                    </span>
                  </div>
                </div>
              )}
              
              <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                Print Area: {selectedProduct?.printAreas[selectedPrintArea]?.maxWidth || 'N/A'}" × {selectedProduct?.printAreas[selectedPrintArea]?.maxHeight || 'N/A'}"
              </div>
              
              {/* Color preview indicator */}
              {getDisplayVariant() && (
                <div style={{ 
                  marginTop: '8px',
                  fontSize: '12px', 
                  color: '#666',
                  fontStyle: 'italic' 
                }}>
                  {hoverColor ? (
                    <span>👀 Previewing: {hoverColor}</span>
                  ) : primaryColor ? (
                    <span>★ Showing primary: {primaryColor}</span>
                  ) : selectedColors.length > 0 ? (
                    <span>Showing: {getDisplayVariant().color}</span>
                  ) : null}
                </div>
              )}
              
              {/* Artwork Controls */}
              {artwork && (
                <div style={{ marginTop: '15px', padding: '10px', border: '1px solid #e1e1e1', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                    Artwork Controls
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px', marginBottom: '8px' }}>
                    <div>
                      <strong>Scale:</strong> {Math.round(artworkScale * 100)}%
                    </div>
                    <div>
                      <strong>Position:</strong> ({Math.round(artworkPosition.x)}, {Math.round(artworkPosition.y)})
                    </div>
                  </div>
                  
                  {/* Quick Fix Buttons - Show prominently when artwork is out of bounds */}
                  {isArtworkOutsidePrintArea && (
                    <div style={{ 
                      marginBottom: '10px', 
                      padding: '8px', 
                      backgroundColor: '#fff3cd', 
                      border: '1px solid #ffeaa7',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#856404', marginBottom: '6px' }}>
                        🔧 Quick Fixes:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <Button
                          size="slim"
                          onClick={autoFitArtwork}
                          tone="success"
                        >
                          Auto Fit
                        </Button>
                        <Button
                          size="slim"
                          onClick={smartResize}
                          tone="success"
                        >
                          Smart Resize
                        </Button>
                        <Button
                          size="slim"
                          onClick={centerArtwork}
                        >
                          Center
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Standard Controls */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button
                      size="slim"
                      onClick={resetArtworkTransform}
                    >
                      Reset Position
                    </Button>
                    <Button
                      size="slim"
                      onClick={autoFitArtwork}
                    >
                      Fit to Area
                    </Button>
                    <Button
                      size="slim"
                      onClick={centerArtwork}
                    >
                      Center
                    </Button>
                  </div>
                  
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                    💡 Drag artwork to move • Drag bottom-right corner to resize
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <Card title="Actions" sectioned>
            <LegacyStack spacing="tight">
              <Button
                primary
                loading={isGeneratingMockup}
                disabled={!artwork}
                onClick={generateMockup}
              >
                Generate Mockup
              </Button>
              <Button
                loading={isCreatingProduct}
                disabled={!artwork || !productTitle.trim() || selectedVariants.length === 0}
                onClick={createShopifyProduct}
              >
                {isEditMode ? 'Update' : 'Create'} Product ({selectedVariants.length} variant{selectedVariants.length !== 1 ? 's' : ''})
              </Button>
            </LegacyStack>
          </Card>
        </LegacyStack>
      </Layout.Section>
    </Layout>
  );
};

export default ProductDecorator;
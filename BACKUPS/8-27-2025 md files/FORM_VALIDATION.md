# Form Validation

## Overview
Real-time form validation system providing immediate feedback, field-level error messages, and accessible validation for all admin panel forms.

## Core Features
- Real-time validation as user types
- Field-level error messages
- Visual error indicators
- Form submission prevention
- Accessible error messages

## Product Form Validation

```javascript
const validateProductForm = (form) => {
  const errors = {};
  
  // Title validation
  if (!form.title?.trim()) {
    errors.title = 'Product title is required';
  } else if (form.title.length < 3) {
    errors.title = 'Title must be at least 3 characters';
  } else if (form.title.length > 255) {
    errors.title = 'Title cannot exceed 255 characters';
  }
  
  // Price validation
  if (!form.base_price) {
    errors.base_price = 'Base price is required';
  } else if (parseFloat(form.base_price) <= 0) {
    errors.base_price = 'Price must be greater than $0';
  } else if (parseFloat(form.base_price) > 10000) {
    errors.base_price = 'Price cannot exceed $10,000';
  }
  
  // Description validation (optional)
  if (form.description?.length > 1000) {
    errors.description = 'Description cannot exceed 1000 characters';
  }
  
  return errors;
};
```

## Variant Form Validation

```javascript
const validateVariantForm = (variant) => {
  const errors = {};
  
  // SKU validation
  if (!variant.sku?.trim()) {
    errors.sku = 'SKU is required';
  } else if (!/^[A-Za-z0-9-_]+$/.test(variant.sku)) {
    errors.sku = 'SKU can only contain letters, numbers, hyphens, and underscores';
  }
  
  // Price validation
  if (!variant.price || parseFloat(variant.price) <= 0) {
    errors.price = 'Price must be greater than $0';
  }
  
  // Inventory validation
  if (variant.inventory_quantity < 0) {
    errors.inventory_quantity = 'Inventory cannot be negative';
  }
  
  return errors;
};
```

## Print Area Validation

```javascript
const validatePrintArea = (printArea) => {
  const errors = {};
  
  // Name validation
  if (!printArea.name?.trim()) {
    errors.name = 'Print area name is required';
  }
  
  // Position validation
  if (printArea.x_position < 0 || printArea.y_position < 0) {
    errors.position = 'Position cannot be negative';
  }
  
  // Dimension validation
  if (printArea.width <= 0 || printArea.height <= 0) {
    errors.dimensions = 'Dimensions must be greater than 0';
  }
  
  if (printArea.width > 5000 || printArea.height > 5000) {
    errors.dimensions = 'Dimensions cannot exceed 5000px';
  }
  
  return errors;
};
```

## Login Form Validation

```javascript
const validateLogin = (credentials) => {
  const errors = {};
  
  if (!credentials.username?.trim()) {
    errors.username = 'Username is required';
  }
  
  if (!credentials.password) {
    errors.password = 'Password is required';
  } else if (credentials.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  
  return errors;
};
```

## Real-time Validation Implementation

### Form State Management
```javascript
const [formData, setFormData] = useState(initialData);
const [errors, setErrors] = useState({});
const [touched, setTouched] = useState({});

// Validate on change
const handleChange = (field, value) => {
  setFormData(prev => ({ ...prev, [field]: value }));
  
  // Only show errors for touched fields
  if (touched[field]) {
    const newErrors = validateForm({ ...formData, [field]: value });
    setErrors(newErrors);
  }
};

// Mark field as touched on blur
const handleBlur = (field) => {
  setTouched(prev => ({ ...prev, [field]: true }));
  const newErrors = validateForm(formData);
  setErrors(newErrors);
};
```

### Error Display Component
```javascript
const FormField = ({ label, name, value, error, onChange, onBlur, type = "text" }) => (
  <div className={`form-field ${error ? 'has-error' : ''}`}>
    <label htmlFor={name}>{label}</label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      onBlur={() => onBlur(name)}
      aria-invalid={!!error}
      aria-describedby={error ? `${name}-error` : undefined}
    />
    {error && (
      <span id={`${name}-error`} className="error-message">
        {error}
      </span>
    )}
  </div>
);
```

## Form Submission

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Validate all fields
  const validationErrors = validateForm(formData);
  setErrors(validationErrors);
  
  // Mark all fields as touched
  const allTouched = Object.keys(formData).reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
  setTouched(allTouched);
  
  // Check if form is valid
  if (Object.keys(validationErrors).length === 0) {
    try {
      await submitForm(formData);
      // Success handling
    } catch (error) {
      // Error handling
    }
  }
};
```

## Validation Rules

### Common Patterns
```javascript
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  sku: /^[A-Za-z0-9-_]+$/,
  phone: /^\+?[\d\s-()]+$/,
  url: /^https?:\/\/.+\..+/
};
```

### Custom Validators
```javascript
// SKU uniqueness check
const checkSkuUnique = async (sku) => {
  const response = await fetch(`/api/admin/variants/check-sku/${sku}`);
  const data = await response.json();
  return data.available;
};

// Async validation
const validateSkuAsync = async (sku) => {
  if (!sku) return 'SKU is required';
  
  const isUnique = await checkSkuUnique(sku);
  if (!isUnique) return 'SKU already exists';
  
  return null;
};
```

## Visual Feedback

### CSS Classes
```css
.form-field.has-error input {
  border-color: #dc3545;
}

.error-message {
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.form-field.valid input {
  border-color: #28a745;
}
```

### Success Indicators
```javascript
{!error && touched[field] && value && (
  <span className="success-icon">✓</span>
)}
```

## Accessibility Features

- **ARIA attributes**: aria-invalid, aria-describedby
- **Error announcements**: Live regions for screen readers
- **Keyboard navigation**: Full keyboard support
- **Clear error messages**: Specific, actionable feedback
- **Focus management**: Auto-focus first error field

## Best Practices

1. Validate on blur, not just on submit
2. Show errors only for touched fields
3. Provide clear, specific error messages
4. Use visual indicators (red borders)
5. Prevent form submission with errors
6. Support async validation (SKU checks)
7. Maintain form state during validation
8. Clear errors when field is corrected
9. Group related validation logic
10. Test with screen readers
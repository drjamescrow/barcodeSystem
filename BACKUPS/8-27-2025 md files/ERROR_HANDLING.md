# Error Handling

## Overview
Comprehensive error handling system providing user-friendly error messages, proper HTTP status codes, React error boundaries, and logging for debugging.

## Core Components

### React Error Boundaries
Global error boundary catches React crashes and provides recovery:
```javascript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### API Error Response Format
Standardized error responses from backend:
```json
{
  "success": false,
  "error": "User-friendly error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific_field",
    "validation": ["validation errors"]
  }
}
```

### HTTP Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request - validation errors
- **401**: Unauthorized - authentication required
- **403**: Forbidden - CORS rejection
- **404**: Not Found - resource doesn't exist
- **409**: Conflict - duplicate resource
- **429**: Too Many Requests - rate limited
- **500**: Internal Server Error

## Form Validation

### Real-time Validation
```javascript
const validateProduct = (form) => {
  const errors = {};
  
  if (!form.title?.trim()) {
    errors.title = 'Product title is required';
  } else if (form.title.length < 3) {
    errors.title = 'Title must be at least 3 characters';
  }
  
  if (!form.base_price || form.base_price <= 0) {
    errors.base_price = 'Price must be greater than $0';
  }
  
  return errors;
};
```

### Field-level Error Display
```javascript
{errors.title && (
  <span className="error-text">{errors.title}</span>
)}
```

## Network Error Handling

### API Call Wrapper
```javascript
const apiCall = async (url, options) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError') {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
};
```

### Retry Logic
```javascript
const retryableApiCall = async (url, options, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};
```

## Error Display Components

### Error Toast
```javascript
const ErrorToast = ({ error, onDismiss }) => {
  if (!error) return null;
  
  return (
    <div className="error-toast">
      <p>{error}</p>
      <button onClick={onDismiss}>×</button>
    </div>
  );
};
```

### Error Alert
```javascript
const ErrorAlert = ({ error, onRetry }) => (
  <div className="alert alert-danger">
    <h4>Error</h4>
    <p>{error}</p>
    {onRetry && (
      <button onClick={onRetry}>Try Again</button>
    )}
  </div>
);
```

## Backend Error Handling

### Express Error Middleware
```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(status).json({
    success: false,
    error: message
  });
});
```

### Database Error Handling
```javascript
try {
  const result = await pool.query(sql, params);
  return result.rows;
} catch (error) {
  if (error.code === '23505') {
    throw new Error('Duplicate entry');
  }
  if (error.code === '23503') {
    throw new Error('Referenced record not found');
  }
  throw error;
}
```

## Webhook Error Handling

### HMAC Verification
```javascript
const verifyWebhook = (req, res, next) => {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody, 'utf8')
    .digest('base64');
  
  if (hash !== hmac) {
    return res.status(401).json({
      success: false,
      error: 'Webhook verification failed'
    });
  }
  next();
};
```

## GraphQL Error Handling

### Shopify GraphQL Errors
```javascript
const result = await shopifyGraphQL(query, variables);

if (result.userErrors?.length > 0) {
  const errors = result.userErrors.map(e => e.message).join(', ');
  throw new Error(`Shopify error: ${errors}`);
}
```

## Authentication Errors

### JWT Validation
```javascript
const authenticateAdmin = (req, res, next) => {
  const token = req.cookies.adminAuth;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};
```

## User-Friendly Messages

### Error Message Mapping
```javascript
const getUserFriendlyMessage = (error) => {
  const errorMap = {
    'ECONNREFUSED': 'Unable to connect to server',
    'ETIMEDOUT': 'Request timed out',
    '401': 'Please log in to continue',
    '403': 'You don\'t have permission to do this',
    '404': 'The requested resource was not found',
    '409': 'This item already exists',
    '500': 'Something went wrong on our end'
  };
  
  return errorMap[error.code] || 'An unexpected error occurred';
};
```

## Best Practices
1. Always catch and handle errors gracefully
2. Provide user-friendly error messages
3. Log errors for debugging
4. Include retry mechanisms where appropriate
5. Validate input before processing
6. Use proper HTTP status codes
7. Implement error boundaries in React
8. Sanitize error messages in production
9. Handle network failures explicitly
10. Provide recovery options to users
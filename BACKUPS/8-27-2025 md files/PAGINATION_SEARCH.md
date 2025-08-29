# Pagination & Search

## Overview
Efficient pagination and real-time search system for managing large datasets with client-side filtering and intuitive navigation.

## Core Features
- Real-time search across multiple fields
- Client-side pagination (10 items per page)
- Smart page navigation controls
- Empty state handling
- Performance optimization

## Search Implementation

### Real-time Search
```javascript
const [searchTerm, setSearchTerm] = useState('');

const filteredProducts = products.filter(product => {
  const searchLower = searchTerm.toLowerCase();
  
  // Search in multiple fields
  return (
    product.title?.toLowerCase().includes(searchLower) ||
    product.description?.toLowerCase().includes(searchLower) ||
    product.variants?.some(v => 
      v.sku?.toLowerCase().includes(searchLower) ||
      v.color?.toLowerCase().includes(searchLower) ||
      v.size?.toLowerCase().includes(searchLower)
    )
  );
});
```

### Search UI Component
```javascript
<input
  type="text"
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  placeholder="Search products..."
  className="search-input"
/>
```

## Pagination Implementation

### Page Calculation
```javascript
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 10;

const totalItems = filteredProducts.length;
const totalPages = Math.ceil(totalItems / itemsPerPage);
const startIndex = (currentPage - 1) * itemsPerPage;
const endIndex = startIndex + itemsPerPage;
const currentProducts = filteredProducts.slice(startIndex, endIndex);
```

### Pagination Controls
```javascript
const PaginationControls = ({ currentPage, totalPages, onPageChange }) => (
  <div className="pagination-controls">
    <button 
      onClick={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 1}
    >
      Previous
    </button>
    
    <span className="page-info">
      Page {currentPage} of {totalPages}
    </span>
    
    <button
      onClick={() => onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
    >
      Next
    </button>
  </div>
);
```

### Smart Page Numbers
```javascript
// Show: 1 ... 4 5 [6] 7 8 ... 20
const getVisiblePages = () => {
  const delta = 2;
  const pages = [];
  
  for (let i = Math.max(1, currentPage - delta);
       i <= Math.min(totalPages, currentPage + delta);
       i++) {
    pages.push(i);
  }
  
  if (currentPage > delta + 1) {
    pages.unshift('...');
    pages.unshift(1);
  }
  
  if (currentPage < totalPages - delta) {
    pages.push('...');
    pages.push(totalPages);
  }
  
  return pages;
};
```

## Order List Pagination

### Server-side Pagination (Orders)
```javascript
// Backend endpoint with pagination
app.get('/api/admin/orders', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  const orders = await pool.query(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  
  const total = await pool.query('SELECT COUNT(*) FROM orders');
  
  res.json({
    orders: orders.rows,
    pagination: {
      page,
      limit,
      total: parseInt(total.rows[0].count),
      pages: Math.ceil(total.rows[0].count / limit)
    }
  });
});
```

## Search Features

### Multi-field Search
- Product titles
- Product descriptions  
- SKUs
- Colors
- Sizes
- Order numbers
- Customer names

### Search Optimization
```javascript
// Debounce search input
useEffect(() => {
  const timer = setTimeout(() => {
    performSearch(searchTerm);
    setCurrentPage(1); // Reset to first page
  }, 300);
  
  return () => clearTimeout(timer);
}, [searchTerm]);
```

## Empty States

### No Results
```javascript
{filteredProducts.length === 0 && (
  <div className="empty-state">
    {searchTerm ? (
      <>
        <h3>No results found</h3>
        <p>Try adjusting your search terms</p>
      </>
    ) : (
      <>
        <h3>No products yet</h3>
        <p>Create your first product to get started</p>
      </>
    )}
  </div>
)}
```

## Performance Optimization

### Virtual Scrolling (Future)
```javascript
// For lists with 1000+ items
import { FixedSizeList } from 'react-window';

const VirtualList = ({ items }) => (
  <FixedSizeList
    height={600}
    itemCount={items.length}
    itemSize={80}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        {items[index].title}
      </div>
    )}
  </FixedSizeList>
);
```

### Memoization
```javascript
// Prevent unnecessary re-renders
const filteredProducts = useMemo(() => {
  return products.filter(/* search logic */);
}, [products, searchTerm]);

const paginatedProducts = useMemo(() => {
  return filteredProducts.slice(startIndex, endIndex);
}, [filteredProducts, startIndex, endIndex]);
```

## UI Components

### Item Counter
```javascript
Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
```

### Page Size Selector
```javascript
<select 
  value={itemsPerPage} 
  onChange={(e) => setItemsPerPage(Number(e.target.value))}
>
  <option value={10}>10 per page</option>
  <option value={25}>25 per page</option>
  <option value={50}>50 per page</option>
</select>
```

## Best Practices
1. Reset to page 1 when search changes
2. Show loading states during data fetching
3. Preserve search/page state in URL params
4. Implement keyboard shortcuts (arrow keys)
5. Mobile-friendly pagination controls
6. Clear indication of current page
7. Disable navigation buttons at boundaries
8. Show total count for context
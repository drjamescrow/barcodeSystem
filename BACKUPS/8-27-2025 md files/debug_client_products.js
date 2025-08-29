const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkClientProducts() {
  try {
    console.log('🔍 Checking client_products table for mockup and print file URLs...\n');
    
    const result = await pool.query(`
      SELECT 
        id, 
        product_title, 
        shopify_product_id,
        mockup_url,
        print_file_url,
        mockup_image_url,
        created_at,
        shop_domain
      FROM client_products 
      WHERE shop_domain = 'indieuprisingtest.myshopify.com'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} client products:\n`);
    
    result.rows.forEach((product, index) => {
      console.log(`${index + 1}. Product: ${product.product_title}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Shopify Product ID: ${product.shopify_product_id}`);
      console.log(`   mockup_url: ${product.mockup_url || 'NULL'}`);
      console.log(`   print_file_url: ${product.print_file_url || 'NULL'}`);
      console.log(`   mockup_image_url: ${product.mockup_image_url || 'NULL'}`);
      console.log(`   Created: ${product.created_at}`);
      console.log('');
    });
    
    // Check for any products with the same Shopify Product ID
    const duplicateCheck = await pool.query(`
      SELECT 
        shopify_product_id,
        COUNT(*) as count,
        array_agg(id ORDER BY created_at DESC) as product_ids,
        array_agg(mockup_url IS NOT NULL ORDER BY created_at DESC) as has_mockup,
        array_agg(print_file_url IS NOT NULL ORDER BY created_at DESC) as has_print_file
      FROM client_products 
      WHERE shop_domain = 'indieuprisingtest.myshopify.com'
      GROUP BY shopify_product_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateCheck.rows.length > 0) {
      console.log('🚨 DUPLICATE PRODUCTS FOUND:');
      duplicateCheck.rows.forEach(row => {
        console.log(`   Shopify Product ID: ${row.shopify_product_id}`);
        console.log(`   Count: ${row.count}`);
        console.log(`   Product IDs: ${row.product_ids}`);
        console.log(`   Has Mockup: ${row.has_mockup}`);
        console.log(`   Has Print File: ${row.has_print_file}`);
        console.log('');
      });
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkClientProducts();
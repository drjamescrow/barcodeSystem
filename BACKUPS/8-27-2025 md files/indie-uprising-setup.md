# Indie Uprising: Delivery Profile Auto‑Setup + Hard‑Coded Fulfillment & Health Check

This guide contains the exact code you can paste into `server.js` to:
- Auto‑add the **Indie Uprising** fulfillment location to the **default Shopify delivery profile** on install and during migrations.
- Hard‑code **all product variants** to the Indie Uprising fulfillment service (no manual fallback).
- Expose a **health check endpoint** to verify setup across OAuth, migrations, and delivery profiles.

> Assumptions:
> - Your app already creates (or ensures) a Shopify **Fulfillment Service** for **Indie Uprising**, which yields a `location_id`.
> - Your product creation route is `POST /api/create-shopify-product`.
> - You’re using `node-fetch` (or `fetch` in Node 18+) and have a logger instance available as `logger`.
> - Shopify Admin API version used below: `2025-01`.

---

## 1) Add a tiny GraphQL helper

Place near your other helpers (e.g., below `registerWebhooks` or utilities).

```js
// --- GraphQL helper for Shopify Admin API ---
async function shopifyGraphQL(shop, accessToken, query, variables = {}) {
  const resp = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await resp.json();
  if (!resp.ok || json.errors) {
    throw new Error(`GraphQL error: ${resp.status} ${JSON.stringify(json.errors || json)}`);
  }
  return json.data;
}
```

---

## 2) Auto‑setup of Delivery Profiles (add Indie Uprising location to default)

Insert this helper anywhere after the GraphQL helper. It:
- fetches the first (default) delivery profile,
- grabs its first location group,
- adds the **Indie Uprising** Location to it.

```js
// --- Delivery Profile auto-setup ---
async function setupDeliveryProfiles(shop, accessToken, locationIdNumeric) {
  const locationGid = `gid://shopify/Location/${locationIdNumeric}`;

  // 1) Get the first (default) delivery profile and its first location group
  const getProfilesQuery = `
    query getDeliveryProfiles {
      deliveryProfiles(first: 1) {
        edges {
          node {
            id
            profileLocationGroups {
              locationGroup { id }
            }
          }
        }
      }
    }
  `;

  const profiles = await shopifyGraphQL(shop, accessToken, getProfilesQuery);
  const profileEdge = profiles?.deliveryProfiles?.edges?.[0];
  if (!profileEdge) throw new Error('No delivery profiles found on shop');

  const profileId = profileEdge.node.id;
  const locationGroupId = profileEdge.node.profileLocationGroups?.[0]?.locationGroup?.id;
  if (!locationGroupId) throw new Error('No location group found on default delivery profile');

  // 2) Update the profile to add our location to that group
  const updateMutation = `
    mutation addLocationToDefaultProfile($id: ID!, $profile: DeliveryProfileInput!) {
      deliveryProfileUpdate(id: $id, profile: $profile) {
        profile { id }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    id: profileId,
    profile: {
      locationGroupsToUpdate: [{
        id: locationGroupId,
        locationsToAdd: [locationGid]
      }]
    }
  };

  const result = await shopifyGraphQL(shop, accessToken, updateMutation, variables);
  const errs = result?.deliveryProfileUpdate?.userErrors || [];
  if (errs.length) throw new Error(`deliveryProfileUpdate userErrors: ${JSON.stringify(errs)}`);
}
```

---

## 3) Call auto‑setup during OAuth install

In your OAuth callback (right after you create or confirm the Indie Uprising fulfillment service and have its `location_id`), **enable** the following call (replace your current commented block if present):

```js
// Auto-setup: add Indie Uprising location to default delivery profile
if (fulfillmentService.location_id) {
  try {
    await setupDeliveryProfiles(shop, tokenData.access_token, fulfillmentService.location_id);
    logger.info('✅ Delivery profile auto-setup complete', {
      shop, locationId: fulfillmentService.location_id
    });
  } catch (e) {
    logger.warn('⚠️ Delivery profile auto-setup failed', {
      shop, error: e.message
    });
  }
}
```

---

## 4) Call auto‑setup during migrations

In your `/api/run-migrations` (or equivalent) path, do the same so existing shops get fixed up:

```js
// Auto-setup for existing shops, too
if (fulfillmentService.location_id) {
  try {
    await setupDeliveryProfiles(shop.shop_domain, shop.access_token, fulfillmentService.location_id);
    logger.info('✅ Delivery profile auto-setup complete (migration)', {
      shop: shop.shop_domain, locationId: fulfillmentService.location_id
    });
  } catch (e) {
    logger.warn('⚠️ Delivery profile auto-setup failed (migration)', {
      shop: shop.shop_domain, error: e.message
    });
  }
}
```

---

## 5) Hard‑code all product variants to Indie Uprising (no manual fallback)

In `POST /api/create-shopify-product`, **force** the Indie Uprising fulfillment service handle onto every variant. Replace your conditional block with this:

```js
// FORCE Indie Uprising for all variants (no manual fallback)
const handleToUse = fulfillmentServiceHandle || 'indie-uprising';
if (productData.variants?.length) {
  productData.variants = productData.variants.map(variant => ({
    ...variant,
    fulfillment_service: handleToUse
  }));
}
logger.info('✅ All variants hard-coded to Indie Uprising', { 
  shopDomain, fulfillmentServiceId, fulfillmentServiceHandle: handleToUse,
  variantCount: productData.variants?.length || 0,
  sampleVariant: productData.variants?.[0] || null
});
```

> If your Indie Uprising service uses a **different handle**, replace `'indie-uprising'` with the exact handle string.

---

## 6) **Health Check Endpoint**

Add this endpoint to `server.js`. It verifies that:
- the Indie Uprising **Location** exists and is **active** (via REST),
- that location is **present in the default delivery profile** (via GraphQL),
- returns a detailed JSON payload for quick diagnostics.

```js
// --- Health check: fulfillment + delivery profile wiring ---
app.get('/api/fulfillment/health', async (req, res) => {
  const { shopDomain } = req.query; // or derive from session/shop context
  if (!shopDomain) return res.status(400).json({ ok: false, error: 'Missing shopDomain' });
  try {
    // 1) Load shop access token and Indie Uprising service info from your DB
    const shop = await db('shops').where({ shop_domain: shopDomain }).first();
    if (!shop?.access_token) throw new Error('Missing access token for shop');

    // If you store fulfillment service by name/handle, fetch from your table;
    // otherwise you can list services via REST and pick Indie Uprising.
    const indieHandle = shop.fulfillment_service_handle || 'indie-uprising';
    const indieServiceId = shop.fulfillment_service_id || null; // may be null if not stored
    const accessToken = shop.access_token;

    const rest = async (path, opts = {}) => {
      const resp = await fetch(`https://${shopDomain}/admin/api/2025-01${path}`, {
        method: opts.method || 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(`${resp.status} ${JSON.stringify(json)}`);
      return json;
    };

    // 2) Confirm fulfillment service + location (REST)
    // If we don't have the numeric location on record, derive by listing locations.
    const locations = await rest('/locations.json');
    const indieLocation = locations.locations.find(l => {
      // Heuristic: when you create a Fulfillment Service, Shopify creates a Location with the same name.
      // If you store the location_id in DB, replace this with a direct lookup.
      return (l.name || '').toLowerCase().includes('indie uprising');
    });

    // 3) Check if location is active and fulfills online orders (REST)
    // Shopify exposes "active" on locations; fulfills_online_orders is part of fulfillment service settings.
    // If needed, call your existing ensure/activate code here.
    const locationStatus = {
      exists: !!indieLocation,
      id: indieLocation?.id || null,
      name: indieLocation?.name || null,
      active: indieLocation?.active ?? null
    };

    // 4) Confirm delivery profile membership (GraphQL)
    let deliveryProfile = null;
    let inDefaultProfile = false;
    let userErrors = [];

    try {
      const data = await shopifyGraphQL(shopDomain, accessToken, `
        query getDefaultProfileAndLocations {
          deliveryProfiles(first: 1) {
            edges {
              node {
                id
                profileLocationGroups {
                  locationGroup {
                    id
                    locations(first: 100) { edges { node { id name } } }
                  }
                }
              }
            }
          }
        }
      `);
      const profileEdge = data?.deliveryProfiles?.edges?.[0];
      deliveryProfile = profileEdge?.node || null;
      const group = deliveryProfile?.profileLocationGroups?.[0]?.locationGroup;
      const locEdges = group?.locations?.edges || [];
      const indieGid = indieLocation ? `gid://shopify/Location/${indieLocation.id}` : null;
      inDefaultProfile = !!(indieGid && locEdges.some(e => e.node.id === indieGid));
    } catch (e) {
      userErrors.push({ message: e.message });
    }

    // 5) Return consolidated status
    return res.json({
      ok: locationStatus.exists && locationStatus.active && inDefaultProfile,
      indieHandle,
      indieServiceId,
      location: locationStatus,
      deliveryProfilePresent: !!deliveryProfile,
      inDefaultProfile,
      notes: [
        'ok=true means: indie location exists, is active, and is present in the default delivery profile.'
      ],
      errors: userErrors
    });
  } catch (err) {
    logger?.warn?.('Health check error', { error: err.message });
    return res.status(500).json({ ok: false, error: err.message });
  }
});
```

**Optional**: If you store the **exact** Indie Uprising `location_id` in your DB, replace the heuristic in the endpoint with a direct lookup and remove the name‑matching step.

---

## 7) Testing checklist

1. Install the app (or re-run migrations) on a test shop.
2. Create a test product with variants via your `/api/create-shopify-product` endpoint.
3. Confirm variants carry `fulfillment_service: "indie-uprising"` in Shopify Admin.
4. Hit: `GET /api/fulfillment/health?shopDomain=<your-shop.myshopify.com>` and verify `ok: true`.
5. Create a draft order for the product and ensure the fulfillment order routes to the Indie Uprising location.

---

## 8) What I still might need from you

- If your **Indie Uprising fulfillment service handle** is **not** `indie-uprising`, tell me the exact handle string so I can update the constant in step 5.
- If you want stricter checks (e.g., verifying `fulfills_online_orders` or ensuring stock locations), let me know and I’ll extend the health check.

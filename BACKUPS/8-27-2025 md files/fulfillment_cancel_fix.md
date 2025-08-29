# Fixing Fulfillment Cancellation Not Updating in Shopify

## Context
You want the Admin “Cancel” action in your fulfillment service app to **return the Fulfillment Order (FO) to the merchant** — by rejecting it if still a request, or closing it if already accepted — without cancelling the Shopify order itself.

Currently, the Admin UI shows a success message, but in Shopify the fulfillment remains **“fulfillment accepted”**. This happens because of gaps in how your cancel handler processes FO states.

---

## What’s Going Wrong

### 1. Accepted + OPEN FOs Aren’t Always Closed
After you accept a fulfillment request, Shopify sets:
- `status: OPEN`
- `requestStatus: ACCEPTED`

Your cancel handler only closes in some `IN_PROGRESS` cases, and sometimes for `ACCEPTED` orders. If you **don’t always** close on any `ACCEPTED` FO, Shopify will keep showing “fulfillment accepted.”

### 2. Wrong FO Picked (`edges[0]`) and Not Filtering to Your Service
You currently pick only the **first** FO returned from Shopify (`edges[0]`). If there are multiple FOs (split order, multiple locations), this can target the wrong FO — which Shopify may reject with `userErrors`.  
You should filter to only FOs assigned to **your fulfillment service location** before deciding to reject or close.

### 3. Success Flag (`shopifySuccess`) Set Too Early
In some branches, you set `shopifySuccess = true` without checking for `userErrors`. This causes the Admin UI to show success even when Shopify didn’t update.

---

## Minimal Fixes (Keeping Your Intended Behavior)

### A. Always Close When Request is ACCEPTED (OPEN or IN_PROGRESS)
```js
if (fo.requestStatus === 'SUBMITTED') {
  await mutate(REJECT_FULFILLMENT_REQUEST, { id: fo.id, reason: 'OTHER', message });
  shopifySuccess = true; // mark success on successful reject
} else if (fo.requestStatus === 'ACCEPTED') {
  const result = await mutate(CLOSE_FULFILLMENT_ORDER, { id: fo.id, message });
  if (result?.fulfillmentOrderClose?.fulfillmentOrder) {
    shopifySuccess = true;
  } else if (result?.fulfillmentOrderClose?.userErrors?.length) {
    // Log and return errors, don't mark success
  }
}
```

### B. Filter FOs to Your Service’s Location
In your `GET_FULFILLMENT_ORDERS` query, request:
```graphql
assignedLocation {
  location {
    id
    name
  }
}
fulfillmentService {
  id
  handle
}
```
Filter FOs before acting:
```js
const myLocationId = process.env.SHOPIFY_LOCATION_GID; // e.g., gid://shopify/Location/123
const myFOs = data.order.fulfillmentOrders.edges
  .map(e => e.node)
  .filter(fo => fo.assignedLocation?.location?.id === myLocationId);
```

### C. Check `userErrors` Before Setting Success
Only set `shopifySuccess = true` when there are no `userErrors`. If there are errors, return them in the API response so the Admin UI reflects the failure.

### D. Make the Cancel Path Single-Pass & Deterministic
1. Fetch FOs
2. Filter to your location
3. Loop:
   - If `SUBMITTED` → reject (`fulfillmentOrderRejectFulfillmentRequest`)
   - If `ACCEPTED` (OPEN or IN_PROGRESS) → close (`fulfillmentOrderClose`)
4. Set success only if at least one mutation succeeds

---

## Why This Fixes the Issue
- An **ACCEPTED** but **OPEN** FO will stay “fulfillment accepted” in Shopify until explicitly **closed**.  
- Your current flow doesn’t always close these FOs and may target the wrong FO.  
- Filtering by location and closing all `ACCEPTED` FOs guarantees the visible status in Shopify changes.

---

**Next Step:** Share your `GET_FULFILLMENT_ORDERS` query, and I can give you a drop-in patch for your cancel handler to handle filtering and consistent closing logic.

# Fixing “Not shipping from this location” for a Shopify fulfillment location

You’re right — creating the fulfillment location isn’t the last step. Shopify won’t show rates “from” that location until it’s **assigned to a delivery (shipping) profile** *and* that profile has zones/rates (manual or app-calculated). That “Not shipping from this location” banner is Shopify telling you the location is either unassigned in the profile, or the group it’s in has no zones/rates yet.

## What you need to do

### 1) Verify the location can ship online
Make sure the location created for your Fulfillment Service is active and `fulfillsOnlineOrders` (if you created it yourself). Creating a Fulfillment Service via GraphQL auto-creates its location; you can also add/update locations directly.

### 2) Find which profiles the location is unassigned to
Query delivery profiles and look for your location under `unassignedLocations`. If it’s there, Shopify won’t offer rates for it at checkout until you assign it to a location group with zones/rates.

```graphql
# List profiles, assigned groups, and unassigned locations
query {
  deliveryProfiles(first: 10) {
    edges {
      node {
        id
        name
        unassignedLocations(first: 50) { id name }
        profileLocationGroups(first: 10) {
          locationGroup { id locations(first: 50) { id name } }
        }
      }
    }
  }
}
```

### 3) Add the location to a group in the profile
Use `deliveryProfileUpdate` and add your location’s ID to an existing group (or create a group). This is the missing step 99% of the time.

```graphql
mutation AssignLocationToProfile(
  $profileId: ID!, $groupId: ID!, $locId: ID!
) {
  deliveryProfileUpdate(
    id: $profileId,
    profile: {
      profileLocationGroups: [
        { id: $groupId, locationsToAdd: [$locId] }
      ]
    }
  ) {
    profile { id }
    userErrors { field message }
  }
}
```

### 4) Make sure the group has zones & rates

- **Manual rates** (flat/weight/price based): add zones and method definitions to the group via `deliveryProfileUpdate`. Shopify’s example shows adding a location and a zone in the same call.
- **App-calculated rates**: create a `DeliveryCarrierService` for your app, then reference it as the **participant** in your profile’s `methodDefinitions`. If you skip this, the location will still say “Not shipping” (no rate provider).

```graphql
# Create your carrier service (your rate callback handles requests)
mutation {
  carrierServiceCreate(input: {
    active: true,
    callbackUrl: "https://yourapp.example.com/shopify/rates",
    format: JSON
  }) {
    carrierService { id }
    userErrors { field message }
  }
}
```

```graphql
# Attach your carrier service to a zone in the profile
mutation UseAppRates(
  $profileId: ID!, $groupId: ID!, $zoneId: ID!, $carrierId: ID!
) {
  deliveryProfileUpdate(
    id: $profileId,
    profile: {
      profileLocationGroups: [{
        id: $groupId,
        locationGroupZones: [{
          id: $zoneId,
          methodDefinitionsToCreate: [{
            active: true,
            name: "App Rates",
            participant: {
              carrierServiceId: $carrierId,
              adaptToNewServices: true,
              participantServices: [{ name: "Standard", active: true }]
            }
          }]
        }]
      }]
    }
  ) {
    userErrors { field message }
  }
}
```

## Why this happens

- Shopify groups locations inside a profile into **location groups**; zones/rates live on the group, not the raw location. New locations can sit **unassigned** until you add them to a group.
- Creating a new *profile* auto-adds locations that can fulfill online, but **adding a new location to an existing profile** doesn’t always auto-link it—hence the banner.
- Fulfillment Service creation does make a location, but it won’t ship until it’s in a profile group that has rates (manual or your app’s carrier).
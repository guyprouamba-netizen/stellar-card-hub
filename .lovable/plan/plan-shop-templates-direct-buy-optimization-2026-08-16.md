# Plan - Shop Templates & Direct Buy Optimization

Implement the requested visual and functional changes for the Shop and Business Dashboard.

## Proposed Changes

### 1. Shop UI Refactor
- **Direct Buy Flow**:
    - Remove the cart system (`cart`, `setCart`, `cartOpen`).
    - Replace "Ajouter" button on product cards with a "Payer" (Pay) or "Voir" button.
    - Create a `ProductDetailModal` component to show:
        - Product name and price.
        - Full description.
        - Media gallery (images and videos).
        - "Acheter" (Buy) button that triggers the payment flow directly for that single product.
- **Visual Cleanups**:
    - Remove the redundant logo above the cover (already in sticky nav).
    - Ensure the footer is robust.

### 2. Business Dashboard Refactor
- **Sidebar Cleanup**:
    - Remove "SMS Sender", "Publication", "WhatsApp Bot", and "Facebook" from the merchant's view as requested.
- **Template Selection**:
    - In "Ma boutique" (Settings tab), add a sub-section or new tab to list available shop templates.
    - Fetch templates using `adminListShopTemplates` (repurposed for user listing if allowed or via a new user-safe endpoint).
    - Allow users to "Preview" and "Apply" templates.

### 3. Backend / API
- Ensure `listShopTemplates` is accessible to authenticated business owners if they are supposed to choose them.

## Technical Details
- **Shop.tsx**: State changes to handle a `selectedProduct` instead of `cart`.
- **Business.tsx**: Update `NAV` array to filter out unwanted items. Add `ShopTemplatesSection` component.
- **MomoPayment**: Used directly from the product detail modal.

## Security Considerations
- Ensure price calculation in `initShopCheckout` still works for single items.

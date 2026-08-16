# Plan: Integration of SMS and Premium Previews

We will implement the requested features: real preview for shop templates, merchant SMS settings (Sender ID requests), and the administrative management of these requests.

## User Interface

### Shop & Business Dashboard
- **Preview System**: Enhancing the `ShopTemplateSelector` in `src/pages/Business.tsx` to include a "Preview" button. This will open the real shop preview in a new tab (`/shop/demo?template_id=...&biz_id=...`), allowing merchants to see their actual products and content with the selected template before applying it.
- **SMS Settings Panel**: Adding a new "SMS" tab in the Business dashboard.
    - Merchants can request a "Sender ID" (sender name).
    - Status tracking: "Pending", "Approved", "Rejected".
    - Integration with the backend to submit these requests to the administrator.
    - SMS credit purchase interface (once Sender ID is approved).

### Administration
- **Sender ID Management**: A new section in the Admin dashboard to review, approve, or reject merchant Sender ID requests.
- **Manual SMS Pricing**: Admin fields to set the price per SMS and the one-time Sender ID request fee (if applicable).

## Technical Details

### Backend (Edge Functions)
- **SMS Handlers**: 
    - `createSenderIdRequest`: Merchants submit a name.
    - `listMySenderIdRequests`: Merchants check status.
    - `adminListSenderRequests` & `adminUpdateSenderRequest`: Admin management.
    - `purchaseSmsCredits`: Deducts wallet balance and credits SMS balance.
- **Shop Handlers**:
    - Update `getPublicShop` to support a "preview" mode where it merges the requested template config with the business data without saving.

### Database Schema (Supabase)
- **sms_sender_requests**: `id`, `business_id`, `user_id`, `sender_id`, `status` (pending/approved/rejected), `admin_note`, `created_at`.
- **sms_credits**: `business_id`, `sender_id`, `balance`, `total_purchased`.
- **platform_config**: Add keys for `sms_unit_price_xof` and `sender_id_fee_xof`.

## Security
- Strict RLS on `sms_sender_requests` to ensure merchants only see their own requests.
- Server-side validation of wallet balance before SMS credit purchase.
- Admin-only access to approval functions.

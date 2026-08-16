# Plan: WhatsApp OTP Mandatory Registration

Mandatory WhatsApp OTP verification for new users during registration to prevent duplicate phone numbers and ensure identity.

## User Review Required

> [!IMPORTANT]
> The WhatsApp OTP will be sent to the number provided during registration. The user must verify this code before their account is fully activated.

- **Unique Phone Number**: We will enforce that a phone number can only be used by one account.
- **Mandatory for New Users**: Existing users are not affected unless they enable 2FA manually.
- **Verification Flow**: Sign Up -> Send OTP to WhatsApp -> Enter OTP -> Access Account.

## Technical Details

### Backend (Supabase Functions)
- **New API Endpoints**:
    - `sendRegistrationOTP`: Generates and sends an OTP via WhatsApp during the signup process.
    - `verifyRegistrationOTP`: Validates the code.
- **`handle2FA` update**: Modify `supabase/functions/api/2fa.ts` to support a `registration` purpose.
- **API `index.ts` update**: Add a public (or semi-public) endpoint to handle these requests if `auth.signUp` doesn't automatically confirm the user (we'll use the existing authenticated `api` function but will need a way to call it during the verification phase). Actually, we'll use a new `public-api` or similar if needed, or stick to the fact that Supabase creates the user but we block access until OTP is verified.

### Database
- **Unique Constraint**: Add a unique constraint on the `phone` column in the `profiles` table if not already present.
- **`user_otp`**: Already exists, will be used with `purpose='registration'`.

### Frontend
- **`Auth.tsx`**:
    - Update the Signup flow to show an OTP input after the initial form submission.
    - Enforce phone number uniqueness check (handled by backend error or pre-check).
    - Call the new OTP verification endpoints.
    - Redirect to dashboard only after successful verification.

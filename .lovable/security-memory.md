
## 2FA Authentication
- 2FA is implemented using WhatsApp OTP via BBG SMS API.
- The flow requires a valid Supabase session, then a secondary OTP verification.
- OTPs are stored in `user_otp` table with a 10-minute expiration.
- The `profiles.two_factor_enabled` flag controls the requirement during login.

Change Password — examples

Endpoint: POST /api/auth/change-password
Headers:
- Authorization: Bearer <JWT>
- Content-Type: application/json

Body:
{
  "currentPassword": "current_pass",
  "newPassword": "new_secure_password"
}

curl examples:

# Example (replace <JWT> and passwords)
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"oldpass","newPassword":"newpass123"}'

# Use jq to pretty-print response
curl -s -X POST http://localhost:3000/api/auth/change-password \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"oldpass","newPassword":"newpass123"}' | jq

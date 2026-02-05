#!/bin/bash
# Create test admin user via Supabase Auth API
# This is resilient to auth schema changes across Supabase versions
#
# Usage: ./scripts/seed-test-user.sh
# Or: npm run supabase:seed-user

set -e

# Check if supabase is running
if ! supabase status --output json > /dev/null 2>&1; then
    echo "Error: Supabase is not running. Start it with: npm run supabase:start"
    exit 1
fi

# Get service role key from supabase status
STATUS=$(supabase status --output json 2>/dev/null)
SERVICE_ROLE_KEY=$(echo "$STATUS" | grep -o '"SERVICE_ROLE_KEY": *"[^"]*"' | cut -d'"' -f4)
API_URL=$(echo "$STATUS" | grep -o '"API_URL": *"[^"]*"' | cut -d'"' -f4)

if [ -z "$SERVICE_ROLE_KEY" ] || [ -z "$API_URL" ]; then
    echo "Error: Could not extract keys from supabase status"
    exit 1
fi

TEST_EMAIL="test@example.com"
TEST_PASSWORD="password123"

echo "Creating test user via Auth API..."

# Create user via Auth Admin API
RESPONSE=$(curl -s -X POST "${API_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"email_confirm\": true,
    \"user_metadata\": {\"display_name\": \"Test Admin\"}
  }")

# Check if user was created or already exists
if echo "$RESPONSE" | grep -q '"id"'; then
    USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "Created test user with ID: $USER_ID"
    
    # Update profile to admin role
    echo "Setting admin role..."
    PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c \
      "UPDATE profiles SET role = 'admin', display_name = 'Test Admin' WHERE email = '${TEST_EMAIL}';" \
      > /dev/null 2>&1 || true
    
    echo ""
    echo "Test user created successfully!"
elif echo "$RESPONSE" | grep -q "already been registered"; then
    echo "Test user already exists."
else
    echo "Warning: Unexpected response: $RESPONSE"
    echo "User may already exist or there was an error."
fi

echo ""
echo "Test credentials:"
echo "  Email: ${TEST_EMAIL}"
echo "  Password: ${TEST_PASSWORD}"

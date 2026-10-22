#!/usr/bin/env bash
# Check that the Cloudflare token in .env.prod can deploy tentui.com.
#
# Usage:
#   pnpm cf:check                 (reads packages/env/.env.prod)
#   pnpm cf:check path/to/.env
#
# Reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID and changes nothing:
# GETs test read access, and POST/PUTs with an invalid body test edit access
# (400/422 means the request was allowed, 401/403 means it was denied).

set -euo pipefail

ENV_FILE="${1:-$(dirname "$0")/../../env/.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
	echo "Error: env file not found: $ENV_FILE" >&2
	exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

T="${CLOUDFLARE_API_TOKEN:-}"
A="${CLOUDFLARE_ACCOUNT_ID:-}"
ZONE=tentui.com
API=https://api.cloudflare.com/client/v4

if [[ -z "$T" || -z "$A" ]]; then
	echo "Error: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in $ENV_FILE" >&2
	exit 1
fi

echo "Token: ${T:0:4}…${T: -4}   Account: ${A:0:4}…${A: -4}"

FAILED=0
check() {
	local label="$1" method="$2" path="$3" body="${4:-}" also_ok="${5:-}"
	local code
	code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" \
		-H "Authorization: Bearer $T" -H 'content-type: application/json' \
		${body:+-d "$body"} "$API$path")
	case "$code" in
		2* | 400 | 422 | "$also_ok") printf '✅ %-30s HTTP %s\n' "$label" "$code" ;;
		*)
			printf '❌ %-30s HTTP %s\n' "$label" "$code"
			FAILED=1
			;;
	esac
}

user=$(curl -s -H "Authorization: Bearer $T" "$API/user/tokens/verify" | jq -r '.result.status // empty')
account=$(curl -s -H "Authorization: Bearer $T" "$API/accounts/$A/tokens/verify" | jq -r '.result.status // empty')
if [[ "$user" == active || "$account" == active ]]; then
	echo "✅ Token active"
else
	echo "❌ Token invalid or expired"
	exit 1
fi

check "Account Settings: Read" GET "/accounts/$A"
# A missing script returns 404 with read access and 403 without it.
check "Workers Scripts: Read" GET "/accounts/$A/workers/scripts/tentui-permission-probe" "" 404
check "Workers Scripts: Edit" PUT "/accounts/$A/workers/scripts/tentui-permission-probe/schedules" '{'
check "Workers Custom Domains" GET "/accounts/$A/workers/domains"
check "D1: Edit" GET "/accounts/$A/d1/database"
check "Workers R2 Storage: Edit" GET "/accounts/$A/r2/buckets"

Z=$(curl -s -H "Authorization: Bearer $T" "$API/zones?name=$ZONE&account.id=$A" | jq -r '.result[0].id // empty')
if [[ -z "$Z" ]]; then
	echo "❌ Zone: Read ($ZONE not visible to this token), skipping zone checks"
	exit 1
fi
echo "✅ Zone: Read ($ZONE)"
check "Workers Routes: Edit" GET "/zones/$Z/workers/routes"
check "DNS: Read" GET "/zones/$Z/dns_records?per_page=1"
check "DNS: Edit" POST "/zones/$Z/dns_records" '{}'

if [[ "$FAILED" == 1 ]]; then
	echo "Some permissions are missing; add them to the token and rerun."
	exit 1
fi
echo "All deploy permissions present."

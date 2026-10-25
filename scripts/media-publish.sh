#!/usr/bin/env bash
#
# Convert component media from .media and publish it to Cloudflare R2.
#
# Input (one image pair is required; the video pair is optional):
#   .media/<slug>-{light,dark}.png
#   .media/<slug>-{light,dark}.mov
#
# Output:
#   .media/converted/<slug>-{light,dark}.webp
#   .media/trimmed/<slug>-{light,dark}.mp4
#
# Usage:
#   pnpm media:publish
#   pnpm media:publish --flush
#   pnpm media:publish --skip-upload
#   pnpm media:publish --force
#
# Uploads go through wrangler (run 'wrangler login' first) and run in
# parallel. Files whose content and headers match the last publish (tracked in
# <MEDIA_DIR>/.published) are skipped; --force uploads everything. --flush purges
# the uploaded URLs from the Cloudflare cache with CLOUDFLARE_API_TOKEN from
# packages/env/.env.prod (needs Zone > Cache Purge).
#
# Environment overrides:
#   R2_BUCKET        (default: tentui)
#   CDN_URL          (default: https://cdn.tentui.com)
#   CDN_ZONE         (default: tentui.com)
#   ENV_FILE         (default: packages/env/.env.prod)
#   MEDIA_DIR        (default: .media)
#   IMAGE_PREFIX     (default: images/components)
#   VIDEO_PREFIX     (default: videos/components)
#   CROP_FILTER      (default: crop=iw-8:ih-8:4:4)
#   TRIM_START_SECS  (default: 2)
#   TRIM_END_SECS    (default: 2)
#   CACHE_CONTROL    (default: public, max-age=3600, must-revalidate)
#   UPLOAD_JOBS      (default: 4)

set -euo pipefail

FLUSH=0
SKIP_UPLOAD=0
FORCE=0

print_help() {
	sed -n '2,/^$/p' "$0" | sed -E 's/^# ?//; s/^#$//'
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--flush)
			FLUSH=1
			shift
			;;
		--skip-upload)
			SKIP_UPLOAD=1
			shift
			;;
		--force)
			FORCE=1
			shift
			;;
		-h | --help)
			print_help
			exit 0
			;;
		*)
			echo "Error: unknown argument: $1" >&2
			echo "Run 'pnpm media:publish --help' for usage." >&2
			exit 1
			;;
	esac
done

cd "$(dirname "$0")/.."

R2_BUCKET="${R2_BUCKET:-tentui}"
CDN_URL="${CDN_URL:-https://cdn.tentui.com}"
CDN_ZONE="${CDN_ZONE:-tentui.com}"
ENV_FILE="${ENV_FILE:-packages/env/.env.prod}"
MEDIA_DIR="${MEDIA_DIR:-.media}"
IMAGE_PREFIX="${IMAGE_PREFIX:-images/components}"
VIDEO_PREFIX="${VIDEO_PREFIX:-videos/components}"
CROP_FILTER="${CROP_FILTER:-crop=iw-8:ih-8:4:4}"
TRIM_START_SECS="${TRIM_START_SECS:-2}"
TRIM_END_SECS="${TRIM_END_SECS:-2}"
CACHE_CONTROL="${CACHE_CONTROL:-public, max-age=3600, must-revalidate}"
UPLOAD_JOBS="${UPLOAD_JOBS:-4}"
# Call the binary directly: going through pnpm adds startup time to every file.
WRANGLER=("$PWD/apps/web/node_modules/.bin/wrangler")

if [[ ! -x "${WRANGLER[0]}" ]]; then
	echo "Error: wrangler not found at ${WRANGLER[0]}. Run 'pnpm install' first." >&2
	exit 1
fi

if [[ ! -d "$MEDIA_DIR" ]]; then
	echo "Error: media directory not found: $MEDIA_DIR" >&2
	exit 1
fi

# wrangler runs from apps/web, so hand it absolute paths.
MEDIA_DIR="$(cd "$MEDIA_DIR" && pwd)"

for command_name in ffmpeg ffprobe; do
	if ! command -v "$command_name" >/dev/null 2>&1; then
		echo "Error: $command_name is not installed or not on PATH." >&2
		exit 1
	fi
done

if [[ "$SKIP_UPLOAD" != "1" ]] && ! "${WRANGLER[@]}" whoami 2>/dev/null | grep "You are logged in" >/dev/null; then
	echo "Error: wrangler is not authenticated." >&2
	echo "Run 'pnpm --dir apps/web exec wrangler login', then retry 'pnpm media:publish'." >&2
	exit 1
fi

if [[ "$SKIP_UPLOAD" != "1" && "$FLUSH" == "1" ]]; then
	if ! command -v jq >/dev/null 2>&1; then
		echo "Error: jq is required with --flush." >&2
		exit 1
	fi
	if [[ ! -f "$ENV_FILE" ]]; then
		echo "Error: env file not found: $ENV_FILE" >&2
		exit 1
	fi
	CLOUDFLARE_API_TOKEN="$(sed -n 's/^CLOUDFLARE_API_TOKEN=//p' "$ENV_FILE" | tr -d '"'"'"'"')"
	if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
		echo "Error: CLOUDFLARE_API_TOKEN is required in $ENV_FILE with --flush." >&2
		exit 1
	fi
fi

WEBP_MODE="ffmpeg"
if ! ffmpeg -hide_banner -encoders 2>/dev/null | grep -E '(^|[[:space:]])libwebp([[:space:]]|$)' >/dev/null; then
	if command -v cwebp >/dev/null 2>&1; then
		if ! cwebp -version >/dev/null 2>&1; then
			echo "Error: cwebp is installed but cannot start." >&2
			echo "Repair its Homebrew libraries with 'brew install libtiff'." >&2
			exit 1
		fi
		WEBP_MODE="cwebp"
	else
		echo "Error: ffmpeg has no WebP encoder and cwebp is not installed." >&2
		echo "Install one with 'brew install webp' or 'brew install ffmpeg'." >&2
		exit 1
	fi
fi

if [[ ! "$TRIM_START_SECS" =~ ^[0-9]+([.][0-9]+)?$ || ! "$TRIM_END_SECS" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
	echo "Error: TRIM_START_SECS and TRIM_END_SECS must be non-negative numbers." >&2
	exit 1
fi

MINIMUM_VIDEO_SECS="$(awk -v start="$TRIM_START_SECS" -v end="$TRIM_END_SECS" \
	'BEGIN { printf "%.6g", start + end }')"

CONVERTED_DIR="$MEDIA_DIR/converted"
TRIMMED_DIR="$MEDIA_DIR/trimmed"
mkdir -p "$CONVERTED_DIR" "$TRIMMED_DIR"

shopt -s nullglob
PNG_FILES=("$MEDIA_DIR"/*.png)
MOV_FILES=("$MEDIA_DIR"/*.mov)

if [[ ${#PNG_FILES[@]} -eq 0 && ${#MOV_FILES[@]} -eq 0 ]]; then
	echo "Error: no .png or .mov files found directly inside $MEDIA_DIR." >&2
	exit 1
fi

validate_name() {
	local file="$1"
	local extension="$2"
	local name
	name="$(basename "$file" ".$extension")"

	if [[ ! "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*-(light|dark)$ ]]; then
		echo "Error: invalid media filename: $(basename "$file")" >&2
		echo "Expected: <component-slug>-{light,dark}.$extension" >&2
		exit 1
	fi
}

for file in "${PNG_FILES[@]}"; do
	validate_name "$file" "png"
	name="$(basename "$file" .png)"
	slug="${name%-light}"
	slug="${slug%-dark}"
	if [[ ! -f "$MEDIA_DIR/$slug-light.png" || ! -f "$MEDIA_DIR/$slug-dark.png" ]]; then
		echo "Error: $slug requires both light and dark PNG files." >&2
		exit 1
	fi
done

for file in ${MOV_FILES[@]+"${MOV_FILES[@]}"}; do
	validate_name "$file" "mov"
	name="$(basename "$file" .mov)"
	slug="${name%-light}"
	slug="${slug%-dark}"
	if [[ ! -f "$MEDIA_DIR/$slug-light.mov" || ! -f "$MEDIA_DIR/$slug-dark.mov" ]]; then
		echo "Error: $slug requires both light and dark MOV files." >&2
		exit 1
	fi
	if [[ ! -f "$MEDIA_DIR/$slug-light.png" || ! -f "$MEDIA_DIR/$slug-dark.png" ]]; then
		echo "Error: $slug videos require matching light and dark PNG files." >&2
		exit 1
	fi
done

GENERATED_IMAGES=()
GENERATED_VIDEOS=()

echo "Converting ${#PNG_FILES[@]} PNG file(s) to lossless WebP..."
for file in "${PNG_FILES[@]}"; do
	name="$(basename "$file" .png)"
	output="$CONVERTED_DIR/$name.webp"

	if [[ "$WEBP_MODE" == "cwebp" ]]; then
		ffmpeg -hide_banner -loglevel error -y \
			-i "$file" \
			-vf "$CROP_FILTER" \
			-f image2pipe -vcodec png - \
			| cwebp -lossless -quiet -o "$output" -- -
	else
		ffmpeg -hide_banner -loglevel error -y \
			-i "$file" \
			-vf "$CROP_FILTER" \
			-c:v libwebp \
			-lossless 1 \
			"$output"
	fi

	GENERATED_IMAGES+=("$output")
	echo "  $output"
done

if [[ ${#MOV_FILES[@]} -gt 0 ]]; then
	echo "Converting ${#MOV_FILES[@]} MOV file(s) to MP4..."
fi

for file in ${MOV_FILES[@]+"${MOV_FILES[@]}"}; do
	name="$(basename "$file" .mov)"
	output="$TRIMMED_DIR/$name.mp4"
	duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file")"

	if [[ ! "$duration" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
		echo "Error: could not read video duration: $file" >&2
		exit 1
	fi

	if ! awk -v duration="$duration" -v start="$TRIM_START_SECS" -v end="$TRIM_END_SECS" \
		'BEGIN { exit !(duration > start + end) }'; then
		echo "Error: $(basename "$file") must be longer than $MINIMUM_VIDEO_SECS seconds." >&2
		exit 1
	fi

	trimmed_duration="$(awk -v duration="$duration" -v start="$TRIM_START_SECS" -v end="$TRIM_END_SECS" \
		'BEGIN { printf "%.6f", duration - start - end }')"

	ffmpeg -hide_banner -loglevel error -y \
		-ss "$TRIM_START_SECS" \
		-i "$file" \
		-t "$trimmed_duration" \
		-vf "$CROP_FILTER" \
		-c:v libx264 \
		-crf 23 \
		-preset slow \
		-pix_fmt yuv420p \
		-movflags +faststart \
		-an \
		"$output"

	GENERATED_VIDEOS+=("$output")
	echo "  $output"
done

if [[ "$SKIP_UPLOAD" == "1" ]]; then
	echo "Done. Upload skipped."
	exit 0
fi

MANIFEST="$MEDIA_DIR/.published"
touch "$MANIFEST"
UPLOAD_LIST="$(mktemp)"
trap 'rm -f "$UPLOAD_LIST"' EXIT
PURGE_URLS=()
SKIPPED=0

# The fingerprint covers the headers too, so changing them re-uploads.
fingerprint() {
	local hash
	hash="$(shasum -a 256 "$1" | cut -d ' ' -f 1)"
	printf '%s|%s|%s' "$hash" "$2" "$CACHE_CONTROL"
}

queue_upload() {
	local file="$1"
	local key="$2"
	local content_type="$3"
	local current previous
	current="$(fingerprint "$file" "$content_type")"
	previous="$(awk -F '\t' -v key="$key" '$1 == key { value = $2 } END { print value }' "$MANIFEST")"

	if [[ "$FORCE" != "1" && "$current" == "$previous" ]]; then
		SKIPPED=$((SKIPPED + 1))
		return
	fi

	printf '%s\0%s\0%s\0%s\0' "$file" "$key" "$content_type" "$current" >>"$UPLOAD_LIST"
	PURGE_URLS+=("$CDN_URL/$key")
}

upload_one() {
	"$WRANGLER_BIN" r2 object put "$R2_BUCKET/$2" \
		--remote \
		--file "$1" \
		--content-type "$3" \
		--cache-control "$CACHE_CONTROL" \
		>/dev/null
	# Single short appends are atomic, so parallel jobs can share the manifest.
	printf '%s\t%s\n' "$2" "$4" >>"$MANIFEST"
	echo "  $CDN_URL/$2"
}

for file in "${GENERATED_IMAGES[@]}"; do
	queue_upload "$file" "$IMAGE_PREFIX/$(basename "$file")" "image/webp"
done

if [[ ${#GENERATED_VIDEOS[@]} -gt 0 ]]; then
	for file in "${GENERATED_VIDEOS[@]}"; do
		queue_upload "$file" "$VIDEO_PREFIX/$(basename "$file")" "video/mp4"
	done
fi

echo "Uploading ${#PURGE_URLS[@]} file(s) to R2 bucket $R2_BUCKET ($SKIPPED unchanged, skipped)..."
if [[ ${#PURGE_URLS[@]} -gt 0 ]]; then
	export -f upload_one
	export WRANGLER_BIN="${WRANGLER[0]}" R2_BUCKET CACHE_CONTROL CDN_URL MANIFEST
	if ! xargs -0 -n 4 -P "$UPLOAD_JOBS" bash -c 'upload_one "$@"' _ <"$UPLOAD_LIST"; then
		echo "Error: one or more uploads failed. Rerun to retry; finished files are skipped." >&2
		exit 1
	fi
fi

# Keep only the latest entry per key.
awk -F '\t' '{ latest[$1] = $0 } END { for (key in latest) print latest[key] }' "$MANIFEST" \
	| sort >"$MANIFEST.tmp"
mv "$MANIFEST.tmp" "$MANIFEST"

if [[ "$FLUSH" == "1" && ${#PURGE_URLS[@]} -gt 0 ]]; then
	api="https://api.cloudflare.com/client/v4"
	auth=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
	zone_id="$(curl -fsS "${auth[@]}" "$api/zones?name=$CDN_ZONE" | jq -r '.result[0].id // empty')"
	if [[ -z "$zone_id" ]]; then
		echo "Error: could not find the Cloudflare zone $CDN_ZONE." >&2
		exit 1
	fi

	echo "Purging Cloudflare cache..."
	# The purge API takes at most 30 URLs per request.
	for ((i = 0; i < ${#PURGE_URLS[@]}; i += 30)); do
		body="$(printf '%s\n' "${PURGE_URLS[@]:i:30}" | jq -R . | jq -s '{files: .}')"
		if ! curl -fsS "${auth[@]}" -H "content-type: application/json" \
			-X POST "$api/zones/$zone_id/purge_cache" -d "$body" \
			| jq -e '.success' >/dev/null; then
			echo "Error: cache purge failed." >&2
			exit 1
		fi
	done
	echo "  purged ${#PURGE_URLS[@]} URL(s)"
fi

echo "Done."

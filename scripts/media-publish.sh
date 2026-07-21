#!/usr/bin/env bash
#
# Convert component media from .media and publish it to S3.
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
#   pnpm media:publish --flush --wait
#   pnpm media:publish --skip-upload
#
# Environment overrides:
#   S3_BUCKET                   (default: dropinme)
#   MEDIA_DIR                   (default: .media)
#   IMAGE_S3_PREFIX             (default: images/components)
#   VIDEO_S3_PREFIX             (default: videos/components)
#   CROP_FILTER                 (default: crop=iw-8:ih-8:4:4)
#   TRIM_START_SECS             (default: 2)
#   TRIM_END_SECS               (default: 2)
#   CACHE_CONTROL               (default: public, max-age=3600, must-revalidate)
#   CLOUDFRONT_DISTRIBUTION_ID  (default: E1KG4OWN5ENLUL)

set -euo pipefail

FLUSH=0
WAIT=0
SKIP_UPLOAD=0

print_help() {
	sed -n '2,/^$/p' "$0" | sed -E 's/^# ?//; s/^#$//'
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--flush)
			FLUSH=1
			shift
			;;
		--wait)
			WAIT=1
			FLUSH=1
			shift
			;;
		--skip-upload)
			SKIP_UPLOAD=1
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

S3_BUCKET="${S3_BUCKET:-dropinme}"
MEDIA_DIR="${MEDIA_DIR:-.media}"
IMAGE_S3_PREFIX="${IMAGE_S3_PREFIX:-images/components}"
VIDEO_S3_PREFIX="${VIDEO_S3_PREFIX:-videos/components}"
CROP_FILTER="${CROP_FILTER:-crop=iw-8:ih-8:4:4}"
TRIM_START_SECS="${TRIM_START_SECS:-2}"
TRIM_END_SECS="${TRIM_END_SECS:-2}"
CACHE_CONTROL="${CACHE_CONTROL:-public, max-age=3600, must-revalidate}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E1KG4OWN5ENLUL}"

if [[ ! -d "$MEDIA_DIR" ]]; then
	echo "Error: media directory not found: $MEDIA_DIR" >&2
	exit 1
fi

for command_name in ffmpeg ffprobe; do
	if ! command -v "$command_name" >/dev/null 2>&1; then
		echo "Error: $command_name is not installed or not on PATH." >&2
		exit 1
	fi
done

if [[ "$SKIP_UPLOAD" != "1" ]] && ! command -v aws >/dev/null 2>&1; then
	echo "Error: aws CLI is not installed or not on PATH." >&2
	exit 1
fi

if [[ "$SKIP_UPLOAD" != "1" ]] && ! aws sts get-caller-identity >/dev/null 2>&1; then
	echo "Error: AWS CLI is not authenticated." >&2
	echo "Run 'aws login', then retry 'pnpm media:publish'." >&2
	exit 1
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

for file in "${MOV_FILES[@]}"; do
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

for file in "${MOV_FILES[@]}"; do
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

INVALIDATION_PATHS=()

echo "Uploading to s3://$S3_BUCKET/..."
for file in "${GENERATED_IMAGES[@]}"; do
	key="$IMAGE_S3_PREFIX/$(basename "$file")"
	aws s3 cp "$file" "s3://$S3_BUCKET/$key" \
		--content-type "image/webp" \
		--cache-control "$CACHE_CONTROL" \
		--only-show-errors
	INVALIDATION_PATHS+=("/$key")
	echo "  /$key"
done

if [[ ${#GENERATED_VIDEOS[@]} -gt 0 ]]; then
	for file in "${GENERATED_VIDEOS[@]}"; do
		key="$VIDEO_S3_PREFIX/$(basename "$file")"
		aws s3 cp "$file" "s3://$S3_BUCKET/$key" \
			--content-type "video/mp4" \
			--cache-control "$CACHE_CONTROL" \
			--only-show-errors
		INVALIDATION_PATHS+=("/$key")
		echo "  /$key"
	done
fi

if [[ "$FLUSH" == "1" ]]; then
	if [[ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]]; then
		echo "Error: CLOUDFRONT_DISTRIBUTION_ID is required with --flush." >&2
		exit 1
	fi

	echo "Invalidating CloudFront paths..."
	INVALIDATION_ID="$(aws cloudfront create-invalidation \
		--distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
		--paths "${INVALIDATION_PATHS[@]}" \
		--query 'Invalidation.Id' \
		--output text)"
	echo "  $INVALIDATION_ID"

	if [[ "$WAIT" == "1" ]]; then
		aws cloudfront wait invalidation-completed \
			--distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
			--id "$INVALIDATION_ID"
	fi
fi

echo "Done."

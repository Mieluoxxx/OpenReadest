#!/usr/bin/env bash

set -uo pipefail

usage() {
  cat <<'USAGE'
Generate three black-and-white OpenReadest logo concepts.

Usage:
  OPENAI_API_KEY='...' bash new_logo/generate-logo-concepts.sh

Optional environment variables:
  OPENAI_BASE_URL  API root (default: https://api.mayoru.com)
  IMAGE_MODEL      Image model (default: gpt-image-2)
  IMAGE_SIZE       Output size (default: 1024x1024)
  IMAGE_QUALITY    Image quality (default: medium)
  OUTPUT_DIR       Output directory (default: new_logo/concepts-<timestamp>)
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

for command in curl jq base64; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "${command}" >&2
    exit 1
  fi
done

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  printf 'OPENAI_API_KEY must be set. Run with --help for usage.\n' >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
base_url="${OPENAI_BASE_URL:-https://api.mayoru.com}"
endpoint="${base_url%/}/v1/images/generations"
model="${IMAGE_MODEL:-gpt-image-2}"
size="${IMAGE_SIZE:-1024x1024}"
quality="${IMAGE_QUALITY:-medium}"
output_dir="${OUTPUT_DIR:-${script_dir}/concepts-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "${output_dir}"

decode_base64() {
  if base64 --decode </dev/null >/dev/null 2>&1; then
    base64 --decode
  else
    base64 -D
  fi
}

sanitize_error_message() {
  jq -r '.error.message // .message // empty' "$1" 2>/dev/null \
    | tr '\r\n' ' ' \
    | cut -c1-240
}

render_concept() {
  local id="$1"
  local prompt="$2"
  local attempt attempt_path body http_status error_message

  printf '%s\n' "${prompt}" > "${output_dir}/${id}.txt"

  for attempt in 1 2 3 4; do
    attempt_path="${output_dir}/${id}-attempt-${attempt}.json"
    body="$(jq -n \
      --arg model "${model}" \
      --arg prompt "${prompt}" \
      --arg size "${size}" \
      --arg quality "${quality}" \
      '{model: $model, prompt: $prompt, size: $size, quality: $quality, output_format: "png", n: 1}')"

    http_status="$(curl -sS \
      --connect-timeout 20 \
      --max-time 180 \
      -o "${attempt_path}" \
      -w '%{http_code}' \
      "${endpoint}" \
      -H "Authorization: Bearer ${OPENAI_API_KEY}" \
      -H 'Content-Type: application/json' \
      -d "${body}")" || http_status="transport-error"

    if [[ "${http_status}" == 2* ]] \
      && jq -e '.data[0].b64_json | strings | length > 0' "${attempt_path}" >/dev/null 2>&1 \
      && jq -er '.data[0].b64_json' "${attempt_path}" | decode_base64 > "${output_dir}/${id}.png"; then
      cp "${attempt_path}" "${output_dir}/${id}.json"
      printf 'Generated %s\n' "${output_dir}/${id}.png"
      return 0
    fi

    error_message="$(sanitize_error_message "${attempt_path}")"
    printf '%s\n' "${id}: attempt ${attempt} failed (HTTP ${http_status}) ${error_message}" >&2
    if [[ "${attempt}" -lt 4 ]]; then
      sleep "$((5 * (2 ** (attempt - 1))))"
    fi
  done

  return 1
}

common_prompt="Create an original square app-logo concept for OpenReadest, an open-source local-first reading application. Pure monochrome black and white, centered on a pure white background, no text, no letters, no numbers, no wordmark. High contrast, bold thick outline, simple geometric silhouette, generous negative space, suitable at 16px favicon and 1024px app icon. Use a contemporary monochrome productivity-app visual language, but do not copy or resemble any existing brand logo. No gradients, no shadows, no 3D, no texture, no mockup, no extra symbols."

open_aperture_prompt="${common_prompt} Direction: front-facing open book made of two mirror-symmetric pages. Its central opening is a clear vertical open gap, like an invitation or doorway. Use no more than three primary black shapes. The open-book reading meaning must be immediately visible, but the mark should remain abstract and compact."

folded_spine_prompt="${common_prompt} Direction: a compact half-open book with a strong central spine and two folded page planes. Use a confident black silhouette and two crisp white page valleys. The book should feel sturdy and precise, with rounded exterior corners and no tiny details."

negative_space_prompt="${common_prompt} Direction: a single bold black rounded-square tile. Carve a white open-book symbol from it using negative space, with a centered V-shaped page seam and large simple page surfaces. Keep the silhouette balanced and instantly recognizable at favicon size."

successes=()
failures=()

for concept in \
  "01-open-aperture-book:${open_aperture_prompt}" \
  "02-folded-spine-book:${folded_spine_prompt}" \
  "03-negative-space-book:${negative_space_prompt}"; do
  id="${concept%%:*}"
  prompt="${concept#*:}"
  if render_concept "${id}" "${prompt}"; then
    successes+=("${id}")
  else
    failures+=("${id}")
  fi
done

printf '\nOutput directory: %s\n' "${output_dir}"
printf 'Generated (%d): %s\n' "${#successes[@]}" "${successes[*]:-none}"

if ((${#failures[@]} > 0)); then
  printf 'Failed (%d): %s\n' "${#failures[@]}" "${failures[*]}" >&2
  exit 1
fi

printf 'All logo concepts generated successfully.\n'

#!/bin/bash

OUTPUT_FILE="project_contents.txt"
LOG_FILE="script_debug.log"
EXCLUDE_REGEX="node_modules|\.next|dist|public|\.idea|\.git|package-lock\.json|tsconfig\.tsbuildinfo|\.log|\.txt|$OUTPUT_FILE|scripts"
MAX_DEPTH=10

cleanup() {
    echo -e "\n\nProcess interrupted. Check $LOG_FILE for details."
    exit 0
}

trap cleanup INT

echo "Starting scan..." | tee -a "$LOG_FILE"
> "$OUTPUT_FILE"
> "$LOG_FILE"

should_exclude() {
    [[ "$1" =~ (^|/)(($EXCLUDE_REGEX))(/|$|\.) ]]
}

log() {
    echo "$(date +'%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

build_tree() {
    local dir="$1"
    local indent="$2"
    local depth="$3"

    local relative_path=$(realpath --relative-to=. "$dir" | sed 's|^\./||')
    log "Processing directory: $relative_path"

    if should_exclude "$relative_path"; then
        log "Skipping excluded: $relative_path"
        return
    fi

    if [ "$depth" -gt "$MAX_DEPTH" ]; then
        log "Max depth reached: $relative_path"
        return
    fi

    local dir_marker=""
    [ -z "$(ls -A "$dir")" ] && dir_marker=" 🔴==EMPTY=="

    echo "${indent}📁 $(basename "$dir")$dir_marker" >> "$OUTPUT_FILE"

    find "$dir" -maxdepth 1 -mindepth 1 \
        ! -path "*/.git/*" \
        ! -name ".git" \
        -print0 2>/dev/null | while IFS= read -r -d $'\0' item; do
        local item_name=$(basename "$item")
        local item_relative=$(realpath --relative-to=. "$item" | sed 's|^\./||')

        if should_exclude "$item_relative"; then
            log "Skipping excluded item: $item_relative"
            continue
        fi

        if [ -d "$item" ]; then
            log "Entering subdirectory: $item_relative"
            build_tree "$item" "${indent}    " $((depth + 1))
        else
            local file_marker=""
            [ ! -s "$item" ] && file_marker=" 🔴==EMPTY=="
            log "Processing file: $item_relative"
            echo "${indent}    📄 $item_name$file_marker" >> "$OUTPUT_FILE"
        fi
    done
}

add_contents() {
    log "Starting file contents processing"

    local exclude_patterns=(
        ! -path "*/.git/*"
        ! -path "./.git/*"
        ! -name ".git"
        ! -path "*/node_modules/*"
        ! -path "*/.next/*"
        ! -path "*/dist/*"
        ! -path "*/public/*"
        ! -path "*/.idea/*"
        ! -path "*/scripts/*"
        ! -name "package-lock.json"
        ! -name "tsconfig.tsbuildinfo"
        ! -name "*.log"
        ! -name "*.txt"
    )

    find . -type f \
        -not -path "*$OUTPUT_FILE" \
        "${exclude_patterns[@]}" | while IFS= read -r file; do

        local rel_path=$(realpath --relative-to=. "$file" | sed 's|^\./||')
        log "Checking file: $rel_path"

        depth=$(tr -cd '/' <<< "$rel_path" | wc -c)
        if [ "$depth" -gt "$MAX_DEPTH" ]; then
            log "Skipping deep file: $rel_path (depth $depth)"
            continue
        fi

        if [ -s "$file" ] && file --mime-encoding "$file" | grep -q 'binary'; then
            log "Skipping binary file: $rel_path"
            continue
        fi

        log "Writing contents of: $rel_path"
        if [ ! -s "$file" ]; then
            echo -e "\n🔴=== FILE: $rel_path === IS EMPTY ===" >> "$OUTPUT_FILE"
        else
            echo -e "\n=== FILE: $rel_path ===" >> "$OUTPUT_FILE"
            head -n 300 "$file" >> "$OUTPUT_FILE" 2>/dev/null
        fi
        echo "" >> "$OUTPUT_FILE"
    done

    find . -type d \
        -not -path "*/.git*" \
        -empty \
        "${exclude_patterns[@]}" | while IFS= read -r dir; do
        local rel_path=$(realpath --relative-to=. "$dir" | sed 's|^\./||')
        echo -e "\n🔴=== DIRECTORY: $rel_path === IS EMPTY ===" >> "$OUTPUT_FILE"
    done
}

echo "Project Structure:" >> "$OUTPUT_FILE"
build_tree "." "" 0

echo -e "\n\nFile Contents:" >> "$OUTPUT_FILE"
add_contents

echo "Done! Results saved to $OUTPUT_FILE"
log "Script completed successfully"
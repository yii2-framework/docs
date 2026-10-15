#!/usr/bin/env bash
# Copies the small, task-declared documentation set and legacy workspace files into an evaluation workspace without
# calling a model.
set -euo pipefail

EVAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${EVAL_DIR}/.." && pwd)"
TASKS_DIR="${EVAL_DIR}/tasks"
SOURCE_DIR="${EVAL_DOCS_SOURCE:-${REPO_DIR}/dist}"

if [[ $# -ne 2 ]]; then
    echo "Usage: eval/prepare-local-docs.sh <task-id> <workspace>" >&2
    exit 2
fi

task="$1"
task_file="${TASKS_DIR}/${task}.md"
workspace="$2"

[[ -f "${task_file}" ]] || {
    echo "Unknown task: ${task}" >&2
    exit 2
}
[[ -d "${SOURCE_DIR}" ]] || {
    echo "Documentation source does not exist: ${SOURCE_DIR}" >&2
    exit 1
}
[[ -d "${workspace}" ]] || {
    echo "Workspace does not exist: ${workspace}" >&2
    exit 1
}

SOURCE_DIR="$(cd "${SOURCE_DIR}" && pwd)"
workspace="$(cd "${workspace}" && pwd)"
destination="${workspace}/.eval-docs"

[[ ! -e "${destination}" ]] || {
    echo "Documentation destination already exists: ${destination}" >&2
    exit 1
}

docs=()
mapfile -t docs < <(php "${EVAL_DIR}/lib/task.php" "${task_file}" docs || true)
[[ ${#docs[@]} -gt 0 ]] || {
    echo "Task ${task} does not declare a docs list." >&2
    exit 1
}

for relative in "${docs[@]}"; do
    if [[ "${relative}" == /* || "${relative}" == .. || "${relative}" == *../* || "${relative}" == */.. ]]; then
        echo "Unsafe documentation path in ${task}: ${relative}" >&2
        exit 1
    fi
    [[ -f "${SOURCE_DIR}/${relative}" ]] || {
        echo "Missing generated documentation: ${SOURCE_DIR}/${relative}" >&2
        exit 1
    }
done

fixtures=()
mapfile -t fixtures < <(php "${EVAL_DIR}/lib/task.php" "${task_file}" workspace || true)

for name in "${fixtures[@]}"; do
    if [[ "${name}" == /* || "${name}" == .. || "${name}" == *../* || "${name}" == */.. ]]; then
        echo "Unsafe workspace fixture in ${task}: ${name}" >&2
        exit 1
    fi
    [[ -d "${EVAL_DIR}/workspace/${name}" ]] || {
        echo "Missing workspace fixture: ${EVAL_DIR}/workspace/${name}" >&2
        exit 1
    }
    while IFS= read -r -d '' file; do
        relative="${file#"${EVAL_DIR}/workspace/${name}/"}"
        [[ ! -e "${workspace}/${relative}" ]] || {
            echo "Workspace fixture would overwrite: ${workspace}/${relative}" >&2
            exit 1
        }
    done < <(find "${EVAL_DIR}/workspace/${name}" -type f -print0)
done

mkdir -p "${destination}"
index="${destination}/INDEX.md"
{
    echo "# Local documentation for ${task}"
    echo
    echo "Read only the page or pages needed for the task. These files were copied from the generated site build."
    echo
} >"${index}"

for relative in "${docs[@]}"; do
    source="${SOURCE_DIR}/${relative}"
    target="${destination}/${relative}"
    mkdir -p "$(dirname "${target}")"
    cp "${source}" "${target}"
    bytes="$(wc -c <"${target}" | tr -d ' ')"
    hash="$(sha256sum "${target}" | cut -d ' ' -f 1)"
    printf -- '- `%s` - %s bytes; SHA-256 `%s`\n' "${relative}" "${bytes}" "${hash}" >>"${index}"
done

for name in "${fixtures[@]}"; do
    cp -a "${EVAL_DIR}/workspace/${name}/." "${workspace}/"
    echo "Copied workspace fixture ${name}"
done

echo "Prepared ${#docs[@]} documentation pages at ${destination}"

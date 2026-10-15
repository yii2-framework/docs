#!/usr/bin/env bash
# Prepares the throwaway Yii 22.0 application that `check.sh` drops task outputs into.
#
# Creates `eval/app` from `yiisoft/yii2-app-basic:^22.0`, tries to add `yii2-extensions/bootstrap6`, records a
# baseline of `./yii help` and `composer static`, and keeps a pristine copy in `eval/.cache/app-pristine` so every
# check starts from the same tree. Re-run with `--force` to rebuild from scratch.
set -euo pipefail

EVAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${EVAL_DIR}/app"
CACHE_DIR="${EVAL_DIR}/.cache"
PRISTINE_DIR="${CACHE_DIR}/app-pristine"
LOG_DIR="${CACHE_DIR}/setup"
STATE_FILE="${CACHE_DIR}/app-state.env"
BOOTSTRAP6_PATH="${BOOTSTRAP6_PATH:-$(cd "${EVAL_DIR}/../../.." && pwd)/yii2-extensions/bootstrap6}"
FORCE=0

usage() {
    cat <<'USAGE'
Usage: eval/setup.sh [--force]

    --force   Delete eval/app and eval/.cache/app-pristine and rebuild them.

Environment:
    BOOTSTRAP6_PATH   Local clone of yii2-extensions/bootstrap6 used when Packagist has no release
                    (default: ../yii2-extensions/bootstrap6 next to the yii2-framework directory).
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --force) FORCE=1 ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

for tool in php composer rsync; do
    command -v "${tool}" >/dev/null || {
        echo "Missing required tool: ${tool}" >&2
        exit 1
    }
done

if [[ ${FORCE} -eq 1 ]]; then
    rm -rf "${APP_DIR}" "${PRISTINE_DIR}" "${STATE_FILE}"
fi

if [[ -d "${APP_DIR}" || -d "${PRISTINE_DIR}" ]]; then
    echo "eval/app or eval/.cache/app-pristine exists; use --force to rebuild." >&2
    exit 1
fi

mkdir -p "${LOG_DIR}"

# Runs a command, logs its output to "${LOG_DIR}/<name>.log", and prints one status line.
run_logged() {
    local name="$1"
    shift
    local status=0
    echo "+ $*" >"${LOG_DIR}/${name}.log"
    "$@" >>"${LOG_DIR}/${name}.log" 2>&1 || status=$?
    echo "${name}: exit ${status} (log: eval/.cache/setup/${name}.log)"
    return "${status}"
}

php_version="$(php -r 'echo PHP_VERSION;')"
composer_version="$(composer --version 2>/dev/null | head -n 1)"

create_status=0
run_logged create-project composer create-project --prefer-dist --stability=dev --no-interaction \
    yiisoft/yii2-app-basic:^22.0 "${APP_DIR}" || create_status=$?

if [[ ${create_status} -ne 0 ]]; then
    echo "composer create-project failed; see eval/.cache/setup/create-project.log" >&2
    exit 1
fi

# yii2-extensions/bootstrap6 is not on Packagist yet (checked 2026-10-13); fall back to a local clone.
bootstrap6_status=0
bootstrap6_source=packagist
run_logged allow-foxy composer --working-dir="${APP_DIR}" config allow-plugins.php-forge/foxy true || true
run_logged require-bootstrap6 composer --working-dir="${APP_DIR}" require --no-interaction \
    php-forge/foxy:^0.4 yii2-extensions/bootstrap6:^0.1 || bootstrap6_status=$?

if [[ ${bootstrap6_status} -ne 0 && -d "${BOOTSTRAP6_PATH}" ]]; then
    bootstrap6_source="path:${BOOTSTRAP6_PATH}"
    bootstrap6_status=0
    composer --working-dir="${APP_DIR}" config repositories.bootstrap6 \
        "{\"type\":\"path\",\"url\":\"${BOOTSTRAP6_PATH}\",\"options\":{\"symlink\":false}}"
    # The first run can abort while Composer replaces the running Foxy 0.2 plugin with 0.4; the retry completes.
    run_logged require-bootstrap6-path composer --working-dir="${APP_DIR}" require --no-interaction \
        php-forge/foxy:^0.4 'yii2-extensions/bootstrap6:^0.1@dev' ||
        run_logged require-bootstrap6-path-retry composer --working-dir="${APP_DIR}" require --no-interaction \
            php-forge/foxy:^0.4 'yii2-extensions/bootstrap6:^0.1@dev' || bootstrap6_status=$?
elif [[ ${bootstrap6_status} -ne 0 ]]; then
    bootstrap6_source=none
fi

# shellcheck disable=SC2016 # PHP code, not shell expansion
bootstrap6_assets="$(php -r '
    $f = $argv[1];
    echo is_file($f) ? (json_decode((string) file_get_contents($f), true)["version"] ?? "unknown") : "missing";
' "${APP_DIR}/node_modules/bootstrap/package.json")"

# The dist archive of the template excludes /runtime (export-ignore); SQLite and the caches need it.
mkdir -p "${APP_DIR}/runtime"

help_status=0
run_logged baseline-yii-help php "${APP_DIR}/yii" help || help_status=$?

static_status=skip
if composer --working-dir="${APP_DIR}" run-script --list 2>/dev/null | grep -qE '^[[:space:]]+static[[:space:]]'; then
    static_status=0
    run_logged baseline-static composer --working-dir="${APP_DIR}" static || static_status=$?
fi

rsync -a "${APP_DIR}/" "${PRISTINE_DIR}/"

cat >"${STATE_FILE}" <<STATE
# Written by eval/setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ).
PHP_VERSION=${php_version}
COMPOSER_VERSION="${composer_version}"
BOOTSTRAP6_STATUS=${bootstrap6_status}
BOOTSTRAP6_SOURCE="${bootstrap6_source}"
BOOTSTRAP6_NPM_VERSION="${bootstrap6_assets}"
BASELINE_HELP_STATUS=${help_status}
BASELINE_STATIC_STATUS=${static_status}
STATE

echo "State written to eval/.cache/app-state.env:"
cat "${STATE_FILE}"

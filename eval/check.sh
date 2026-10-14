#!/usr/bin/env bash
# Runs the deterministic checks of each task against the files a model (or a fixture) produced.
#
# Layout of a run directory: <run-dir>/<task-id>/files/<relative paths listed in the task outputs>. The checks of a
# task come from the `checks` list of eval/tasks/<task-id>.md. Results go to <out>/results.tsv, <out>/summary.md,
# and <out>/summary.json; per-check logs and rendered HTML go to <out>/<task-id>/checks/.
set -euo pipefail

EVAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKS_DIR="${EVAL_TASKS_DIR:-${EVAL_DIR}/tasks}"
SEED_DIR="${EVAL_DIR}/seed"
APP_DIR="${EVAL_DIR}/app"
PRISTINE_DIR="${EVAL_DIR}/.cache/app-pristine"
STATE_FILE="${EVAL_DIR}/.cache/app-state.env"
PHP_BIN="${PHP_BIN:-php}"

usage() {
    cat <<'USAGE'
Usage: eval/check.sh <run-dir> [--task <id>]... [--out <dir>]

    <run-dir>     Directory with one <task-id>/files/ tree per task (an eval/out/<timestamp> run or a fixture set).
    --task <id>   Check only this task (repeatable). Default: every task directory found in <run-dir>.
    --out <dir>   Where to write results.tsv, summary.md, summary.json, and logs. Default: <run-dir>.

Exit code: 0 when every selected task passes, 1 when a check fails, 2 on usage errors.
USAGE
}

RUN_DIR=""
OUT_DIR=""
SELECTED=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --task)
            SELECTED+=("${2:?--task needs a value}")
            shift
            ;;
        --out)
            OUT_DIR="${2:?--out needs a value}"
            shift
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        -*)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
        *)
            [[ -z "${RUN_DIR}" ]] || {
                echo "Only one run directory is accepted." >&2
                exit 2
            }
            RUN_DIR="$1"
            ;;
    esac
    shift
done

[[ -n "${RUN_DIR}" && -d "${RUN_DIR}" ]] || {
    usage >&2
    exit 2
}
RUN_DIR="$(cd "${RUN_DIR}" && pwd)"
OUT_DIR="${OUT_DIR:-${RUN_DIR}}"
mkdir -p "${OUT_DIR}"
OUT_DIR="$(cd "${OUT_DIR}" && pwd)"
RESULTS="${OUT_DIR}/results.tsv"
CURRENT_FILES=""
: >"${RESULTS}"

APP_READY=0
BASELINE_STATIC_STATUS=skip
if [[ -d "${APP_DIR}" && -d "${PRISTINE_DIR}" && -f "${STATE_FILE}" ]]; then
    APP_READY=1
    BASELINE_STATIC_STATUS="$(sed -n 's/^BASELINE_STATIC_STATUS=//p' "${STATE_FILE}")"
fi

if [[ ${#SELECTED[@]} -eq 0 ]]; then
    while IFS= read -r dir; do
        SELECTED+=("$(basename "${dir}")")
    done < <(find "${RUN_DIR}" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9]-*' | sort)
fi

[[ ${#SELECTED[@]} -gt 0 ]] || {
    echo "No task directories in ${RUN_DIR}." >&2
    exit 2
}

# Appends one result row: task, check, status (pass|fail|skip), one-line detail.
record() {
    local detail="${4//$'\t'/ }"
    detail="${detail//$'\n'/ | }"
    printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "${detail:0:400}" >>"${RESULTS}"
    printf '  %-4s %s %s\n' "$3" "$2" "${detail:0:100}"
}

# Restores eval/app from the pristine copy, keeping vendor/ and node_modules/ (outputs never touch them).
restore_app() {
    rsync -a --delete --exclude /vendor/ --exclude /node_modules/ "${PRISTINE_DIR}/" "${APP_DIR}/"
}

# Runs a command with output to a log file; returns the command status.
run_log() {
    local log="$1"
    shift
    local status=0
    echo "+ $*" >"${log}"
    "$@" >>"${log}" 2>&1 || status=$?
    return "${status}"
}

# Prints the last non-empty line of a log, for the detail column.
last_line() {
    grep -v '^[[:space:]]*$' "$1" | tail -n 1 || true
}

check_task() {
    local task="$1"
    local task_file="${TASKS_DIR}/${task}.md"
    local files="${RUN_DIR}/${task}/files"
    local logs="${OUT_DIR}/${task}/checks"
    local skill prepared=0 render_state=none render_target="" app_skip=""

    echo "${task}"
    CURRENT_FILES="${files}"

    if [[ ! -f "${task_file}" ]]; then
        record "${task}" task fail "no task definition ${task_file}"
        return
    fi

    mkdir -p "${logs}"
    rm -f "${logs}"/*.html "${logs}"/*.js.txt
    skill="$("${PHP_BIN}" "${EVAL_DIR}/lib/task.php" "${task_file}" skill)"

    if [[ ${APP_READY} -eq 0 ]]; then
        app_skip="eval/app not prepared (run eval/setup.sh)"
    elif [[ "${skill}" == yii2-bootstrap6-widgets && ! -d "${APP_DIR}/vendor/yii2-extensions/bootstrap6" ]]; then
        app_skip="yii2-extensions/bootstrap6 is not installed in eval/app"
    fi

    local outputs=() checks=() seeds=()
    mapfile -t outputs < <("${PHP_BIN}" "${EVAL_DIR}/lib/task.php" "${task_file}" outputs || true)
    mapfile -t checks < <("${PHP_BIN}" "${EVAL_DIR}/lib/task.php" "${task_file}" checks || true)
    mapfile -t seeds < <("${PHP_BIN}" "${EVAL_DIR}/lib/task.php" "${task_file}" seed || true)

    local check kind arg
    for check in "${checks[@]}"; do
        kind="${check%%:*}"
        arg=""
        [[ "${check}" == *:* ]] && arg="${check#*:}"

        if [[ ! -d "${files}" ]]; then
            record "${task}" "${check}" fail "no files directory"
            continue
        fi

        case "${kind}" in
            outputs)
                local missing=() path
                for path in "${outputs[@]}"; do
                    [[ -s "${files}/${path}" ]] || missing+=("${path}")
                done
                if [[ ${#missing[@]} -eq 0 ]]; then
                    record "${task}" "${check}" pass "${#outputs[@]} expected files present"
                else
                    record "${task}" "${check}" fail "missing: ${missing[*]}"
                fi
                ;;
            php-lint)
                local php_files=() bad=() file
                mapfile -t php_files < <(find "${files}" -type f -name '*.php' | sort)
                for file in "${php_files[@]}"; do
                    "${PHP_BIN}" -l "${file}" >/dev/null 2>&1 || bad+=("${file#"${files}"/}")
                done
                if [[ ${#php_files[@]} -eq 0 ]]; then
                    record "${task}" "${check}" fail "no PHP files"
                elif [[ ${#bad[@]} -eq 0 ]]; then
                    record "${task}" "${check}" pass "${#php_files[@]} files"
                else
                    record "${task}" "${check}" fail "syntax errors: ${bad[*]}"
                fi
                ;;
            strict-types)
                local without
                without="$(find "${files}" -type f -name '*.php' -print0 |
                    xargs -0 -r grep -LE 'declare\s*\(\s*strict_types\s*=\s*1\s*\)' | sed "s|${files}/||" || true)"
                if [[ -z "${without}" ]]; then
                    record "${task}" "${check}" pass "declare(strict_types=1) in every PHP file"
                else
                    record "${task}" "${check}" fail "missing in: ${without}"
                fi
                ;;
            grep)
                local hits
                hits="$(grep -rlE -e "${arg}" -- "${files}" | sed "s|${files}/||" || true)"
                if [[ -n "${hits}" ]]; then
                    record "${task}" "${check}" pass "found in: ${hits}"
                else
                    record "${task}" "${check}" fail "pattern not found"
                fi
                ;;
            no-forbidden)
                local found
                found="$(grep -rnE -e "${arg}" -- "${files}" | sed "s|${files}/||" || true)"
                if [[ -z "${found}" ]]; then
                    record "${task}" "${check}" pass "absent"
                else
                    record "${task}" "${check}" fail "${found}"
                fi
                ;;
            migration-methods)
                local migration_files=()
                mapfile -t migration_files < <(find "${files}/src/migrations" -type f -name '*.php' 2>/dev/null | sort)
                if [[ ${#migration_files[@]} -eq 0 ]]; then
                    record "${task}" "${check}" fail "no PHP migration files under src/migrations/"
                elif run_log "${logs}/migration-methods.log" "${PHP_BIN}" \
                    "${EVAL_DIR}/lib/migration-methods.php" "${migration_files[@]}"; then
                    record "${task}" "${check}" pass "$(last_line "${logs}/migration-methods.log")"
                else
                    record "${task}" "${check}" fail "$(last_line "${logs}/migration-methods.log")"
                fi
                ;;
            app-boot | app-migrate | app-probe | app-render | app-static)
                if [[ -n "${app_skip}" ]]; then
                    record "${task}" "${check}" skip "${app_skip}"
                    [[ "${kind}" == app-render ]] && render_state=skipped
                    [[ "${kind}" == app-boot ]] && record "${task}" app-boot:composer-static skip "${app_skip}"
                    continue
                fi

                if [[ "${kind}" == app-probe && "${render_state}" == failed && "${arg#*:}" == "${render_target}" ]]; then
                    record "${task}" "${check}" skip \
                        "dependent view probe skipped: app-render failed for ${render_target}"
                    continue
                fi

                if [[ ${prepared} -eq 0 ]]; then
                    restore_app
                    local seed
                    for seed in "${seeds[@]}"; do
                        rsync -a "${SEED_DIR}/${seed}/" "${APP_DIR}/"
                    done
                    rsync -a "${files}/" "${APP_DIR}/"
                    prepared=1
                fi

                local app_status=0
                app_check "${task}" "${check}" "${kind}" "${arg}" "${logs}" || app_status=$?
                if [[ "${kind}" == app-render ]]; then
                    render_target="${arg}"
                    if [[ ${app_status} -eq 0 ]]; then
                        render_state=passed
                    else
                        render_state=failed
                    fi
                fi
                ;;
            html | no-html)
                if [[ "${render_state}" == skipped ]]; then
                    record "${task}" "${check}" skip "nothing rendered (${app_skip})"
                    continue
                fi
                if [[ "${render_state}" == failed ]]; then
                    record "${task}" "${check}" skip \
                        "dependent HTML check skipped: app-render failed for ${render_target}"
                    continue
                fi
                local html_files=()
                mapfile -t html_files < <(find "${logs}" -maxdepth 1 -name '*.html' | sort)
                if [[ ${#html_files[@]} -eq 0 ]]; then
                    record "${task}" "${check}" fail "no rendered HTML"
                    continue
                fi
                local matched=0
                grep -qE -e "${arg}" -- "${html_files[@]}" && matched=1
                if [[ "${kind}" == html && ${matched} -eq 1 ]] || [[ "${kind}" == no-html && ${matched} -eq 0 ]]; then
                    record "${task}" "${check}" pass "rendered HTML checked"
                else
                    local verb=lacks
                    [[ ${matched} -eq 1 ]] && verb=contains
                    record "${task}" "${check}" fail "rendered HTML ${verb} the pattern"
                fi
                ;;
            js | no-js)
                if [[ "${render_state}" == skipped ]]; then
                    record "${task}" "${check}" skip "nothing rendered (${app_skip})"
                    continue
                fi
                if [[ "${render_state}" == failed ]]; then
                    record "${task}" "${check}" skip \
                        "dependent registered-script check skipped: app-render failed for ${render_target}"
                    continue
                fi
                local js_files=()
                mapfile -t js_files < <(find "${logs}" -maxdepth 1 -name '*.js.txt' | sort)
                if [[ ${#js_files[@]} -eq 0 ]]; then
                    record "${task}" "${check}" fail "no registered scripts"
                    continue
                fi
                local js_matched=0
                grep -qE -e "${arg}" -- "${js_files[@]}" && js_matched=1
                if [[ "${kind}" == js && ${js_matched} -eq 1 ]] || [[ "${kind}" == no-js && ${js_matched} -eq 0 ]]; then
                    record "${task}" "${check}" pass "registered scripts checked"
                else
                    local js_verb=lacks
                    [[ ${js_matched} -eq 1 ]] && js_verb=contains
                    record "${task}" "${check}" fail "registered scripts ${js_verb} the pattern"
                fi
                ;;
            *)
                record "${task}" "${check}" fail "unknown check type '${kind}'"
                ;;
        esac
    done

    if [[ ${prepared} -eq 1 ]]; then
        restore_app
    fi
}

# Runs one check against the prepared application.
app_check() {
    local task="$1" check="$2" kind="$3" arg="$4" logs="$5"
    local slug="${check//[^A-Za-z0-9._-]/_}"
    local log="${logs}/${slug}.log"

    case "${kind}" in
        app-boot)
            if run_log "${log}" "${PHP_BIN}" "${APP_DIR}/yii" help; then
                record "${task}" "${check}" pass "./yii help exits 0"
            else
                record "${task}" "${check}" fail "./yii help: $(last_line "${log}")"
            fi

            if [[ "${BASELINE_STATIC_STATUS}" != 0 ]]; then
                record "${task}" app-boot:composer-static skip \
                    "composer static fails on the pristine app (baseline ${BASELINE_STATIC_STATUS}); see app-static"
            elif run_log "${logs}/composer-static.log" composer --working-dir="${APP_DIR}" static; then
                record "${task}" app-boot:composer-static pass "composer static exits 0"
            else
                record "${task}" app-boot:composer-static fail "$(last_line "${logs}/composer-static.log")"
            fi
            ;;
        app-migrate)
            if run_log "${log}" "${PHP_BIN}" "${APP_DIR}/yii" migrate --interactive=0 &&
                run_log "${log}.down" "${PHP_BIN}" "${APP_DIR}/yii" migrate/down 1 --interactive=0 &&
                run_log "${log}.up" "${PHP_BIN}" "${APP_DIR}/yii" migrate --interactive=0; then
                record "${task}" "${check}" pass "migrate, migrate/down 1, migrate succeed"
            else
                local last
                last="$(cat "${log}" "${log}.down" "${log}.up" 2>/dev/null | grep -v '^[[:space:]]*$' | tail -n 1)"
                record "${task}" "${check}" fail "${last}"
            fi
            ;;
        app-probe)
            local probe="${arg%%:*}" target="${arg#*:}"
            if run_log "${log}" "${PHP_BIN}" "${EVAL_DIR}/lib/probe.php" "${APP_DIR}" "${probe}" "${target}"; then
                record "${task}" "${check}" pass "$(last_line "${log}")"
            else
                record "${task}" "${check}" fail "$(last_line "${log}")"
            fi
            ;;
        app-render)
            local html="${logs}/${arg//[^A-Za-z0-9._-]/_}.html"
            local javascript="${html%.html}.js.txt"
            if run_log "${log}" "${PHP_BIN}" "${EVAL_DIR}/lib/probe.php" "${APP_DIR}" render "${arg}" "${html}"; then
                record "${task}" "${check}" pass "$(last_line "${log}")"
                return 0
            else
                rm -f "${html}" "${javascript}"
                record "${task}" "${check}" fail "$(last_line "${log}")"
                return 1
            fi
            ;;
        app-static)
            local targets=() rel
            while IFS= read -r rel; do
                targets+=("${APP_DIR}/${rel}")
            done < <(cd "${CURRENT_FILES}" && find src config resources/views -type f -name '*.php' 2>/dev/null | sort || true)
            if [[ ${#targets[@]} -eq 0 ]]; then
                record "${task}" "${check}" skip "no PHP files under src/, config/, or resources/views/"
                return
            fi
            local neon="${logs}/phpstan.neon"
            {
                echo "parameters:"
                echo "    level: ${EVAL_PHPSTAN_LEVEL:-5}"
                echo "    tmpDir: ${APP_DIR}/runtime/phpstan"
                echo "    paths:"
                printf '        - %s\n' "${targets[@]}"
            } >"${neon}"
            if run_log "${log}" "${APP_DIR}/vendor/bin/phpstan" analyse --configuration="${neon}" --no-progress \
                --error-format=raw --memory-limit=512M; then
                record "${task}" "${check}" pass "phpstan level ${EVAL_PHPSTAN_LEVEL:-5}: no errors"
            else
                local errors
                errors="$(grep -m 3 -E '^/' "${log}" | sed "s|${APP_DIR}/||g" || true)"
                record "${task}" "${check}" fail "${errors:-$(last_line "${log}")}"
            fi
            ;;
    esac
}

for task in "${SELECTED[@]}"; do
    check_task "${task}"
done

"${PHP_BIN}" "${EVAL_DIR}/lib/summary.php" "${RESULTS}" "${RUN_DIR}" "${OUT_DIR}"

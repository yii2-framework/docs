#!/usr/bin/env bash
# Runs the agent evaluation: for each task, a model gets only llms.txt and one skill, writes files, and check.sh
# verifies them. Uses Claude Code headless (`claude -p`) with the maintainer's own login; no API key is involved.
set -euo pipefail

EVAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${EVAL_DIR}/.." && pwd)"
TASKS_DIR="${EVAL_DIR}/tasks"
SKILLS_DIR="${REPO_DIR}/skills"
PUBLIC_BASE="https://yii2-framework.github.io/docs/"
LOCAL_BASE="${EVAL_LOCAL_BASE:-http://localhost:4321/docs/}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"

MODEL="sonnet"
EFFORT=""
BUDGET_USD="1.00"
TIMEOUT_SECONDS="900"
DOCS_BASE="auto"
DRY_RUN=0
RUN_CHECK=1
NO_SKILL=0
SELECTED=()

usage() {
    cat <<'USAGE'
Usage: eval/run.sh [--task <id>]... [--model <alias>] [--dry-run] [options]

    --task <id>         Run only this task (repeatable), e.g. 08-alert-theme. Default: every task.
    --model <alias>     Model passed to `claude --model` (default: sonnet).
    --effort <level>    Optional `claude --effort` value (low, medium, high, xhigh, max).
    --budget-usd <n>    `claude --max-budget-usd` cap per task (default: 1.00).
    --timeout <seconds> Wall-clock limit per task (default: 900).
    --docs-base <base>  auto (default), public, local, or a URL ending in /docs/. `local` rewrites the public
                        documentation URLs in the prompt to the preview server (EVAL_LOCAL_BASE).
    --dry-run           Assemble prompt.md and command.txt per task; do not call the model or the checker.
    --no-check          Skip eval/check.sh after the model runs.
    --no-skill          Baseline condition: omit the <skill> block (and the words "and the skill") from the prompt.
                        Everything else, including the command line and the fresh workspace, stays identical.

Results: eval/out/<UTC timestamp>/<task-id>/{prompt.md,command.txt,result.json,stderr.log,meta.json,files/}
and eval/out/<UTC timestamp>/summary.{md,json} from check.sh.
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --task)
            SELECTED+=("${2:?--task needs a value}")
            shift
            ;;
        --model)
            MODEL="${2:?--model needs a value}"
            shift
            ;;
        --effort)
            EFFORT="${2:?--effort needs a value}"
            shift
            ;;
        --budget-usd)
            BUDGET_USD="${2:?--budget-usd needs a value}"
            shift
            ;;
        --timeout)
            TIMEOUT_SECONDS="${2:?--timeout needs a value}"
            shift
            ;;
        --docs-base)
            DOCS_BASE="${2:?--docs-base needs a value}"
            shift
            ;;
        --dry-run) DRY_RUN=1 ;;
        --no-check) RUN_CHECK=0 ;;
        --no-skill) NO_SKILL=1 ;;
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

for tool in php rsync curl timeout; do
    command -v "${tool}" >/dev/null || {
        echo "Missing required tool: ${tool}" >&2
        exit 1
    }
done

if [[ ${DRY_RUN} -eq 0 ]] && ! command -v "${CLAUDE_BIN}" >/dev/null; then
    echo "Claude Code CLI not found (${CLAUDE_BIN}); install it or set CLAUDE_BIN." >&2
    exit 1
fi

if [[ ${#SELECTED[@]} -eq 0 ]]; then
    while IFS= read -r file; do
        SELECTED+=("$(basename "${file}" .md)")
    done < <(find "${TASKS_DIR}" -maxdepth 1 -name '[0-9][0-9]-*.md' | sort)
fi

for task in "${SELECTED[@]}"; do
    [[ -f "${TASKS_DIR}/${task}.md" ]] || {
        echo "Unknown task: ${task}" >&2
        exit 2
    }
done

http_ok() {
    [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1" || true)" == 200 ]]
}

# Resolves the documentation base URL the agent is told to fetch from.
case "${DOCS_BASE}" in
    auto)
        if http_ok "${PUBLIC_BASE}guide/index.md"; then
            DOCS_BASE="${PUBLIC_BASE}"
        elif http_ok "${LOCAL_BASE}guide/index.md"; then
            DOCS_BASE="${LOCAL_BASE}"
        else
            DOCS_BASE="${PUBLIC_BASE}"
            echo "Warning: neither ${PUBLIC_BASE} nor ${LOCAL_BASE} serves guide/index.md; fetches will fail." >&2
        fi
        ;;
    public) DOCS_BASE="${PUBLIC_BASE}" ;;
    local) DOCS_BASE="${LOCAL_BASE}" ;;
    http://* | https://*) [[ "${DOCS_BASE}" == */ ]] || DOCS_BASE="${DOCS_BASE}/" ;;
    *)
        echo "Invalid --docs-base: ${DOCS_BASE}" >&2
        exit 2
        ;;
esac

# Resolves llms.txt: the local build first, then the preview server, then the public site.
LLMS_SOURCE=""
LLMS_TEXT=""
if [[ -s "${REPO_DIR}/dist/llms.txt" ]]; then
    LLMS_SOURCE="dist/llms.txt"
    LLMS_TEXT="$(cat "${REPO_DIR}/dist/llms.txt")"
else
    for url in "${LOCAL_BASE}llms.txt" "${PUBLIC_BASE}llms.txt"; do
        if http_ok "${url}"; then
            LLMS_SOURCE="${url}"
            LLMS_TEXT="$(curl -s --max-time 30 "${url}")"
            break
        fi
    done
fi
[[ -n "${LLMS_TEXT}" ]] || {
    echo "llms.txt not found (dist/, ${LOCAL_BASE}, ${PUBLIC_BASE})." >&2
    exit 1
}

rebase() {
    if [[ "${DOCS_BASE}" == "${PUBLIC_BASE}" ]]; then
        cat
    else
        sed "s|${PUBLIC_BASE}|${DOCS_BASE}|g"
    fi
}

DOCS_HOST="$(sed -E 's|^https?://([^/:]+).*|\1|' <<<"${DOCS_BASE}")"
ALLOWED_TOOLS="Read,Write,Edit,Glob,Grep,WebFetch(domain:${DOCS_HOST})"
STAMP="${EVAL_RUN_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
RUN_DIR="${EVAL_OUT_ROOT:-${EVAL_DIR}/out}/${STAMP}"
mkdir -p "${RUN_DIR}"
printf '%s\n' "${LLMS_TEXT}" | rebase >"${RUN_DIR}/llms.txt"

echo "Run directory: ${RUN_DIR#"${REPO_DIR}"/}"
echo "llms.txt: ${LLMS_SOURCE}; docs base: ${DOCS_BASE}; model: ${MODEL}; budget per task: ${BUDGET_USD} USD"
if [[ ${NO_SKILL} -eq 1 ]]; then CONDITION="no-skill"; else CONDITION="skill-injected"; fi
echo "condition: ${CONDITION}"

# Writes the prompt of one task to stdout.
assemble_prompt() {
    local task_file="$1" skill="$2"
    local title context=() attached="llms.txt and the skill"
    [[ ${NO_SKILL} -eq 1 ]] && attached="llms.txt"
    title="$(php "${EVAL_DIR}/lib/task.php" "${task_file}" title)"
    mapfile -t context < <(php "${EVAL_DIR}/lib/task.php" "${task_file}" context || true)

    cat <<HEADER
# Task: ${title}

You are a PHP developer working on a Yii 22.0 application. Complete the task below by writing the requested files
into the current working directory, with paths relative to it. Do not ask questions: make reasonable choices and
finish in one pass. No shell is available; you can read, write, and edit files, and fetch documentation pages.

HEADER
    php "${EVAL_DIR}/lib/task.php" "${task_file}" --body
    cat <<DOCS

## Documentation

The only documentation you may rely on is attached: ${attached}; fetch pages by their index.md URL if you
need details. Do not use other websites or your memory of older Yii versions when they disagree with these sources.
DOCS
    if [[ ${#context[@]} -gt 0 ]]; then
        echo
        echo "Pages that are likely relevant:"
        echo
        printf -- '- %s\n' "${context[@]}" | rebase
    fi
    cat <<FOOTER

When you are done, reply with the list of files you wrote.

FOOTER
    if [[ ${NO_SKILL} -eq 0 ]]; then
        echo "<skill name=\"${skill}\">"
        rebase <"${SKILLS_DIR}/${skill}/SKILL.md"
        echo "</skill>"
        echo
    fi
    echo "<llms_txt source=\"${DOCS_BASE}llms.txt\">"
    cat "${RUN_DIR}/llms.txt"
    echo "</llms_txt>"
}

# Writes meta.json for one task from the CLI result (if any) and the measured wall time.
write_meta() {
    local task_dir="$1" exit_code="$2" wall="$3" work="$4"
    # shellcheck disable=SC2016 # PHP code, not shell expansion
    php -r '
        [, $dir, $exit, $wall, $model, $base, $llms, $dry, $work, $condition] = $argv;
        $file = "$dir/result.json";
        $result = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        $meta = [
            "task" => basename($dir),
            "model" => $model,
            "condition" => $condition,
            "dry_run" => $dry === "1",
            "exit_code" => (int) $exit,
            "wall_seconds" => (float) $wall,
            "docs_base" => $base,
            "llms_source" => $llms,
            "work_dir" => $work,
        ];
        if (is_array($result)) {
            foreach (["subtype", "is_error", "num_turns", "duration_ms", "duration_api_ms", "total_cost_usd",
                "usage", "modelUsage", "session_id", "permission_denials"] as $key) {
                if (array_key_exists($key, $result)) {
                    $meta[$key] = $result[$key];
                }
            }
        }
        file_put_contents("$dir/meta.json", json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    ' "${task_dir}" "${exit_code}" "${wall}" "${MODEL}" "${DOCS_BASE}" "${LLMS_SOURCE}" "${DRY_RUN}" "${work}" "${CONDITION}"
}

for task in "${SELECTED[@]}"; do
    task_file="${TASKS_DIR}/${task}.md"
    task_dir="${RUN_DIR}/${task}"
    mkdir -p "${task_dir}"
    skill="$(php "${EVAL_DIR}/lib/task.php" "${task_file}" skill)"
    [[ -f "${SKILLS_DIR}/${skill}/SKILL.md" ]] || {
        echo "Missing skill: ${skill}" >&2
        exit 1
    }

    assemble_prompt "${task_file}" "${skill}" >"${task_dir}/prompt.md"

    command=("${CLAUDE_BIN}" -p
        --model "${MODEL}"
        --output-format json
        --safe-mode
        --restricted
        --no-session-persistence
        --strict-mcp-config
        --tools "Read,Write,Edit,Glob,Grep,WebFetch"
        --allowed-tools "${ALLOWED_TOOLS}"
        --permission-mode dontAsk
        --permission-prompts none
        --max-budget-usd "${BUDGET_USD}")
    if [[ -n "${EFFORT}" ]]; then
        command+=(--effort "${EFFORT}")
    fi
    printf '%q ' "${command[@]}" >"${task_dir}/command.txt"
    printf '< prompt.md (cwd: a fresh temporary directory)\n' >>"${task_dir}/command.txt"

    if [[ ${DRY_RUN} -eq 1 ]]; then
        write_meta "${task_dir}" 0 0 ""
        echo "${task}: prompt.md written ($(wc -c <"${task_dir}/prompt.md") bytes), model not called"
        continue
    fi

    work="$(mktemp -d "${EVAL_WORK_ROOT:-${TMPDIR:-/tmp}}/yii2-docs-eval.XXXXXX")"
    if [[ -n "$(find "${work}" -mindepth 1 -print -quit)" ]]; then
        echo "Workspace ${work} is not empty; refusing to run ${task}." >&2
        exit 1
    fi
    start="$(date +%s.%N)"
    exit_code=0
    (cd "${work}" && timeout "${TIMEOUT_SECONDS}" "${command[@]}" <"${task_dir}/prompt.md" \
        >"${task_dir}/result.json" 2>"${task_dir}/stderr.log") || exit_code=$?
    end="$(date +%s.%N)"
    # shellcheck disable=SC2016 # PHP code, not shell expansion
    wall="$(php -r 'printf("%.1f", $argv[2] - $argv[1]);' "${start}" "${end}")"

    mkdir -p "${task_dir}/files"
    rsync -a --exclude /.claude/ "${work}/" "${task_dir}/files/"
    rm -rf "${work}"
    write_meta "${task_dir}" "${exit_code}" "${wall}" "${work}"

    echo "${task}: exit ${exit_code}, ${wall}s, $(find "${task_dir}/files" -type f | wc -l) files" \
        "(details: ${task_dir#"${REPO_DIR}"/}/meta.json)"
done

if [[ ${DRY_RUN} -eq 0 && ${RUN_CHECK} -eq 1 ]]; then
    "${EVAL_DIR}/check.sh" "${RUN_DIR}" || true
fi

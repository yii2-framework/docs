<?php

declare(strict_types=1);

/**
 * Writes `summary.json` and `summary.md` from the `results.tsv` produced by `check.sh`.
 *
 * Usage: php summary.php <results.tsv> <run-dir> <out-dir>
 *
 * A task passes when none of its checks fails (skipped checks do not count). When `<run-dir>/<task>/meta.json`
 * exists (written by `run.sh`), its model, wall time, turns, and cost are copied into the summary.
 */

if ($argc !== 4) {
    fwrite(STDERR, "Usage: php summary.php <results.tsv> <run-dir> <out-dir>\n");
    exit(2);
}

[$script, $resultsFile, $runDir, $outDir] = $argv;
$lines = file($resultsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

if ($lines === false) {
    fwrite(STDERR, "Cannot read {$resultsFile}\n");
    exit(2);
}

$tasks = [];

foreach ($lines as $line) {
    [$task, $check, $status, $detail] = array_pad(explode("\t", $line, 4), 4, '');
    $tasks[$task] ??= ['id' => $task, 'status' => 'pass', 'pass' => 0, 'fail' => 0, 'skip' => 0, 'checks' => []];
    $tasks[$task]['checks'][] = ['check' => $check, 'status' => $status, 'detail' => $detail];
    $tasks[$task][$status] = ($tasks[$task][$status] ?? 0) + 1;

    if ($status === 'fail') {
        $tasks[$task]['status'] = 'fail';
    }
}

$totals = ['tasks' => count($tasks), 'tasks_passed' => 0, 'checks' => 0, 'pass' => 0, 'fail' => 0, 'skip' => 0];
$cost = 0.0;
$hasCost = false;

foreach ($tasks as $id => $task) {
    $metaFile = "{$runDir}/{$id}/meta.json";

    if (is_file($metaFile)) {
        $meta = json_decode((string) file_get_contents($metaFile), true);

        if (is_array($meta)) {
            $tasks[$id]['run'] = array_intersect_key(
                $meta,
                array_flip(['model', 'exit_code', 'wall_seconds', 'num_turns', 'total_cost_usd', 'is_error']),
            );

            if (is_numeric($meta['total_cost_usd'] ?? null)) {
                $cost += (float) $meta['total_cost_usd'];
                $hasCost = true;
            }
        }
    }

    $totals['tasks_passed'] += $task['status'] === 'pass' ? 1 : 0;
    $totals['checks'] += count($task['checks']);

    foreach (['pass', 'fail', 'skip'] as $status) {
        $totals[$status] += $task[$status];
    }
}

$summary = [
    'generated_at' => gmdate('Y-m-d\TH:i:s\Z'),
    'run_dir' => $runDir,
    'totals' => $totals + [
        'task_pass_rate' => $totals['tasks'] > 0 ? round($totals['tasks_passed'] / $totals['tasks'], 3) : 0,
        'total_cost_usd' => $hasCost ? round($cost, 4) : null,
    ],
    'tasks' => array_values($tasks),
];

file_put_contents(
    "{$outDir}/summary.json",
    json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n",
);

$md = [
    '# Evaluation summary',
    '',
    "Run: `{$runDir}`. Generated {$summary['generated_at']}.",
    '',
    sprintf(
        'Tasks passed: %d of %d. Checks: %d pass, %d fail, %d skip.%s',
        $totals['tasks_passed'],
        $totals['tasks'],
        $totals['pass'],
        $totals['fail'],
        $totals['skip'],
        $hasCost ? sprintf(' Reported cost: %.4f USD.', $cost) : '',
    ),
    '',
    '| Task | Status | Pass | Fail | Skip | Turns | Wall (s) | Cost (USD) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
];

foreach ($tasks as $task) {
    $run = $task['run'] ?? [];
    $md[] = sprintf(
        '| %s | %s | %d | %d | %d | %s | %s | %s |',
        $task['id'],
        $task['status'],
        $task['pass'],
        $task['fail'],
        $task['skip'],
        $run['num_turns'] ?? '-',
        $run['wall_seconds'] ?? '-',
        isset($run['total_cost_usd']) ? sprintf('%.4f', $run['total_cost_usd']) : '-',
    );
}

foreach ($tasks as $task) {
    $md[] = '';
    $md[] = "## {$task['id']}";
    $md[] = '';
    $md[] = '| Check | Status | Detail |';
    $md[] = '| --- | --- | --- |';

    foreach ($task['checks'] as $check) {
        $md[] = sprintf(
            '| `%s` | %s | %s |',
            str_replace('|', '\|', $check['check']),
            $check['status'],
            str_replace('|', '\|', $check['detail']),
        );
    }
}

file_put_contents("{$outDir}/summary.md", implode("\n", $md) . "\n");

printf(
    "Summary: %d/%d tasks passed; %d pass, %d fail, %d skip. Wrote %s/summary.md and summary.json.\n",
    $totals['tasks_passed'],
    $totals['tasks'],
    $totals['pass'],
    $totals['fail'],
    $totals['skip'],
    $outDir,
);

exit($totals['fail'] > 0 ? 1 : 0);

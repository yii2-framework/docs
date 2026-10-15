<?php

declare(strict_types=1);

/** @var app\models\Post $model */

// Wrong on purpose: hand-written Bootstrap 5 modal markup and an unencoded title.
?>
<button type="button" class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#delete">Delete</button>
<div class="modal" id="delete">
    <p><?= $model->title ?> will be removed.</p>
</div>

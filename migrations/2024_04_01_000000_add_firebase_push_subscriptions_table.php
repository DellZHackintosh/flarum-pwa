<?php

/*
 * This file is part of askvortsov/flarum-pwa
 *
 *  Copyright (c) 2021 Alexander Skvortsov.
 *
 *  For detailed copyright and license information, please view the
 *  LICENSE file that was distributed with this source code.
 */

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable(
    'firebase_push_subscriptions',
    function (Blueprint $table) {
        $table->increments('id');
        $table->string('token')->unique();
        $table->unsignedInteger('user_id');

        $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
    }
);

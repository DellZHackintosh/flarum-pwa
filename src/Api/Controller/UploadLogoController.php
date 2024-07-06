<?php

/*
 * This file is part of askvortsov/flarum-pwa
 *
 *  Copyright (c) 2021 Alexander Skvortsov.
 *
 *  For detailed copyright and license information, please view the
 *  LICENSE file that was distributed with this source code.
 */

namespace Askvortsov\FlarumPWA\Api\Controller;

use Askvortsov\FlarumPWA\PWATrait;
use Askvortsov\FlarumPWA\Util;
use Flarum\Api\Controller\UploadImageController;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Intervention\Image\Image;
use Intervention\Image\ImageManager;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Tobscure\JsonApi\Document;
use Illuminate\Contracts\Filesystem\Factory;
use Flarum\Settings\SettingsRepositoryInterface;


class UploadLogoController extends UploadImageController
{
    use PWATrait;

    protected mixed $size;

    public function __construct(SettingsRepositoryInterface $settings, Factory $filesystemFactory)
    {
        parent::__construct($settings, $filesystemFactory);
    }

    /**
     * {@inheritdoc}
     * @throws PermissionDeniedException|RouteNotFoundException
     */
    public function data(ServerRequestInterface $request, Document $document)
    {
        RequestUtil::getActor($request)->assertAdmin();

        $size = Arr::get($request->getQueryParams(), 'size');
        $size = intval($size);
        $this->size = $size;

        if (! in_array($size, Util::$ICON_SIZES)) {
            throw new RouteNotFoundException();
        }


        $this->filenamePrefix = "pwa-icon-{$size}x{$size}";
        $this->fileExtension = 'png';
        $this->filePathSettingKey = "askvortsov-pwa.icon_{$size}_path";

        $file = Arr::get($request->getUploadedFiles(), $this->filenamePrefix);

        return parent::data($request, $document);
    }

    protected function makeImage(UploadedFileInterface $file): Image
    {
        $manager = new ImageManager();

        return $manager->make($file->getStream())->resize($this->size, $this->size)->encode('png');
    }
}

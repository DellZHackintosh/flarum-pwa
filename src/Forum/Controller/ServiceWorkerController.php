<?php

namespace Askvortsov\FlarumPWA\Forum\Controller;

use Askvortsov\FlarumPWA\PWATrait;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Contracts\Filesystem\FileNotFoundException;
use Illuminate\Contracts\Filesystem\Filesystem;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Flarum\Settings\SettingsRepositoryInterface;


class ServiceWorkerController implements RequestHandlerInterface
{
    use PWATrait;

    protected Filesystem $assetDir;
    protected string $timestamp;
    protected string $offlineVar;
    const REV_MANIFEST = 'rev-manifest.json';
    const LAST_REV = 'last-rev.json';

    public function __construct(Factory $filesystemFactory)
    {
        $this->assetDir = $filesystemFactory->disk('flarum-assets');
        $settings = resolve(SettingsRepositoryInterface::class);
        $offlinePath = $settings->get('askvortsov-pwa.customOfflinePage', '/offline');
        $this->offlineVar = 'const offlineFallbackPage = "' . $offlinePath . '";' . PHP_EOL;
        if ($this->assetDir->exists(static::REV_MANIFEST) && $this->assetDir->exists(static::LAST_REV) && $this->assetDir->get(static::REV_MANIFEST) == $this->assetDir->get(static::LAST_REV)) {
            $this->timestamp = '// Generated on ' . $settings->get('askvortsov-pwa.swTime') . PHP_EOL;
        } else {
            $this->assetDir->put(static::LAST_REV, $this->assetDir->get(static::REV_MANIFEST));
            $settings->set('askvortsov-pwa.swTime', date("Y-m-d H:i:s"));
            $this->timestamp = '// Generated on ' . $settings->get('askvortsov-pwa.swTime') . PHP_EOL;
        }
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return new TextResponse($this->timestamp . $this->offlineVar . $this->assetDir->get('extensions/askvortsov-pwa/sw.js'), 200, ['content-type' => 'text/javascript; charset=utf-8']);
    }
}
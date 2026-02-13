<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

/*
|--------------------------------------------------------------------------
| Cached media route — serves storage files with aggressive cache headers.
| Works everywhere (php artisan serve, Apache, Nginx).
| Files have UUID names and never change, so 1-year immutable cache is safe.
|--------------------------------------------------------------------------
*/
Route::get('/media/{path}', function (string $path) {
    $disk = Storage::disk('public');

    if (!$disk->exists($path)) {
        abort(404);
    }

    $fullPath = $disk->path($path);
    $mime = $disk->mimeType($path);
    $size = $disk->size($path);
    $lastModified = $disk->lastModified($path);
    $etag = md5($path . $lastModified . $size);

    // Return 304 if client already has this version
    $ifNoneMatch = request()->header('If-None-Match');
    if ($ifNoneMatch === $etag) {
        return response('', 304)->withHeaders([
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'ETag' => $etag,
        ]);
    }

    $response = new BinaryFileResponse($fullPath);
    $response->headers->set('Content-Type', $mime);
    $response->headers->set('Cache-Control', 'public, max-age=31536000, immutable');
    $response->headers->set('ETag', $etag);
    $response->headers->set('Access-Control-Allow-Origin', '*');

    return $response;
})->where('path', '.*')->name('media.serve');

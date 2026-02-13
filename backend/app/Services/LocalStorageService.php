<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Facades\Image;

class LocalStorageService
{
    /**
     * Upload a file to local storage.
     */
    public function upload(UploadedFile $file, string $folder = 'portfolio'): array
    {
        $extension = $file->getClientOriginalExtension();
        $filename = Str::uuid() . '.' . $extension;
        $path = $file->storeAs($folder, $filename, 'public');

        $isGif = strtolower($extension) === 'gif';
        $isVideo = strtolower($extension) === 'mp4';
        $width = null;
        $height = null;

        if ($isVideo) {
            // Skip image processing for video files
        } elseif (!$isGif) {
            try {
                $image = Image::make($file->getRealPath());
                $width = $image->width();
                $height = $image->height();
            } catch (\Exception $e) {
                // If image reading fails, leave dimensions null
            }
        } else {
            try {
                $imageSize = getimagesize($file->getRealPath());
                if ($imageSize) {
                    $width = $imageSize[0];
                    $height = $imageSize[1];
                }
            } catch (\Exception $e) {
                // ignore
            }
        }

        return [
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
            'width' => $width,
            'height' => $height,
            'size' => $file->getSize(),
            'extension' => $extension,
        ];
    }

    /**
     * Generate a thumbnail for the uploaded image.
     */
    public function generateThumbnail(string $sourcePath, int $width = 400, int $height = 300): string
    {
        $disk = Storage::disk('public');
        $fullPath = $disk->path($sourcePath);

        $info = pathinfo($sourcePath);
        $extension = strtolower($info['extension'] ?? 'jpg');
        $thumbnailFilename = $info['filename'] . '_thumb.jpg';
        $thumbnailPath = $info['dirname'] . '/thumbnails/' . $thumbnailFilename;

        // Create thumbnails directory if it doesn't exist
        $thumbnailDir = dirname($disk->path($thumbnailPath));
        if (!is_dir($thumbnailDir)) {
            mkdir($thumbnailDir, 0755, true);
        }

        try {
            if ($extension === 'gif') {
                // For GIFs, extract first frame and create a JPG thumbnail
                $image = Image::make($fullPath);
                $image->fit($width, $height)
                      ->encode('jpg', 85)
                      ->save($disk->path($thumbnailPath));
            } else {
                $image = Image::make($fullPath);
                $image->fit($width, $height)
                      ->encode('jpg', 85)
                      ->save($disk->path($thumbnailPath));
            }
        } catch (\Exception $e) {
            \Log::error('Thumbnail generation error: ' . $e->getMessage());
            // If thumbnail generation fails, return original image URL
            return $disk->url($sourcePath);
        }

        return $disk->url($thumbnailPath);
    }

    /**
     * Delete a file and its thumbnail from local storage.
     */
    public function delete(string $path): bool
    {
        try {
            $disk = Storage::disk('public');

            // Delete the main file
            if ($disk->exists($path)) {
                $disk->delete($path);
            }

            // Delete the thumbnail
            $info = pathinfo($path);
            $thumbnailPath = $info['dirname'] . '/thumbnails/' . $info['filename'] . '_thumb.jpg';
            if ($disk->exists($thumbnailPath)) {
                $disk->delete($thumbnailPath);
            }

            return true;
        } catch (\Exception $e) {
            \Log::error('Local storage delete error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Validate an uploaded file.
     */
    public static function validateFile(UploadedFile $file): array
    {
        $errors = [];
        $extension = strtolower($file->getClientOriginalExtension());
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4'];
        $allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];
        $maxSize = 500 * 1024 * 1024; // 500MB

        // Check extension
        if (!in_array($extension, $allowedExtensions)) {
            $errors[] = 'Invalid file extension. Allowed: ' . implode(', ', $allowedExtensions);
        }

        // Check MIME type
        $mimeType = $file->getMimeType();
        if (!in_array($mimeType, $allowedMimeTypes)) {
            $errors[] = 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4';
        }

        // Check file size
        if ($file->getSize() > $maxSize) {
            $errors[] = 'File size exceeds maximum of 500MB';
        }

        // Verify that the file is actually an image (skip for video)
        if ($extension !== 'mp4') {
            try {
                $imageInfo = getimagesize($file->getRealPath());
                if ($imageInfo === false) {
                    $errors[] = 'File is not a valid image';
                }
            } catch (\Exception $e) {
                $errors[] = 'Could not verify file as a valid image';
            }
        }

        return $errors;
    }
}

<?php

namespace App\Services;

use CloudinaryLabs\CloudinaryLaravel\Facades\Cloudinary;

class CloudinaryService
{
    /**
     * Check if Cloudinary is properly configured
     */
    protected function ensureConfigured(): void
    {
        $url = config('cloudinary.cloud_url');
        if (empty($url) || str_contains($url, 'your_cloud_name') || str_contains($url, 'your_api_key') || str_contains($url, 'placeholder')) {
            throw new \RuntimeException(
                'Cloudinary is not configured. Please set CLOUDINARY_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file. ' .
                'Get free credentials at: https://cloudinary.com/users/register_free'
            );
        }
    }

    public function upload($file, string $folder = 'portfolio'): array
    {
        $this->ensureConfigured();

        $result = Cloudinary::upload($file->getRealPath(), [
            'folder' => $folder,
            'resource_type' => 'image',
            'quality' => 'auto',
            'fetch_format' => 'auto',
        ]);

        return [
            'public_id' => $result->getPublicId(),
            'secure_url' => $result->getSecurePath(),
            'url' => $result->getPath(),
            'width' => $result->getWidth(),
            'height' => $result->getHeight(),
            'bytes' => $result->getSize(),
            'format' => $result->getExtension(),
        ];
    }

    public function generateThumbnail(string $publicId, int $width = 400, int $height = 300, bool $isGif = false): string
    {
        $transformation = [
            'width' => $width,
            'height' => $height,
            'crop' => 'fill',
            'quality' => 'auto',
            'fetch_format' => 'auto',
        ];

        if ($isGif) {
            // For GIFs, get static first frame as thumbnail
            $transformation['page'] = 1;
            $transformation['fetch_format'] = 'jpg';
        }

        return cloudinary_url($publicId, ['transformation' => [$transformation]]);
    }

    public function getStaticFrame(string $publicId): string
    {
        return cloudinary_url($publicId, [
            'transformation' => [
                [
                    'page' => 1,
                    'fetch_format' => 'jpg',
                    'quality' => 'auto',
                    'width' => 400,
                    'height' => 300,
                    'crop' => 'fill',
                ],
            ],
        ]);
    }

    public function delete(string $publicId): bool
    {
        try {
            Cloudinary::destroy($publicId);
            return true;
        } catch (\Exception $e) {
            \Log::error('Cloudinary delete error: ' . $e->getMessage());
            return false;
        }
    }

    public function optimize(string $publicId): string
    {
        return cloudinary_url($publicId, [
            'transformation' => [
                [
                    'quality' => 'auto',
                    'fetch_format' => 'auto',
                ],
            ],
        ]);
    }
}

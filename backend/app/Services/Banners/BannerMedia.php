<?php

namespace App\Services\Banners;

/**
 * What a template is made of and what an order produces:
 *  - video templates (MP4/MOV background) render to MP4, plus a GIF when enabled;
 *  - image templates (PNG/JPG/WebP background) render to PNG, plus a JPG when enabled.
 * Order snapshots carry the kind, so an order always produces what it was bought as.
 */
class BannerMedia
{
    public const VIDEO = 'video';
    public const IMAGE = 'image';
    public const KINDS = [self::VIDEO, self::IMAGE];

    /** Every result format, in display order; the first of each kind is always produced. */
    public const FORMATS = ['mp4', 'gif', 'png', 'jpg'];

    public const MIME = [
        'mp4' => 'video/mp4',
        'gif' => 'image/gif',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
    ];

    public static function kindOf(?array $snapshot): string
    {
        return ($snapshot['kind'] ?? null) === self::IMAGE ? self::IMAGE : self::VIDEO;
    }

    /** The format that is always produced for a kind. */
    public static function primary(string $kind): string
    {
        return $kind === self::IMAGE ? 'png' : 'mp4';
    }

    /** @return string[] formats a template of this kind with these outputs produces */
    public static function formats(string $kind, ?array $outputs): array
    {
        if ($kind === self::IMAGE) {
            return ($outputs['jpg']['enabled'] ?? false) ? ['png', 'jpg'] : ['png'];
        }
        return ($outputs['gif']['enabled'] ?? false) ? ['mp4', 'gif'] : ['mp4'];
    }

    /** "MP4 and GIF", "PNG and JPG", "MP4" */
    public static function label(array $formats): string
    {
        return implode(' and ', array_map('strtoupper', $formats));
    }
}

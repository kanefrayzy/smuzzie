<?php

namespace App\Enums;

/** Processing state of a template's uploaded video (probe, master, watermarked preview, poster). */
enum BannerTemplateStatus: string
{
    case None = 'none';             // no video uploaded yet
    case Pending = 'pending';       // queued for processing
    case Processing = 'processing';
    case Ready = 'ready';
    case Failed = 'failed';
}

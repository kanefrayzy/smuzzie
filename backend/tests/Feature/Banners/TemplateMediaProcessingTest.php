<?php

namespace Tests\Feature\Banners;

use App\Enums\BannerTemplateStatus;
use App\Jobs\ProcessBannerTemplate;
use App\Models\BannerTemplate;
use App\Services\Banners\Ffmpeg;
use App\Services\Banners\TemplateMediaProcessor;
use App\Services\Banners\WatermarkGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Runs real ffmpeg/ffprobe on tiny generated clips. Skipped when ffmpeg isn't installed.
 */
class TemplateMediaProcessingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (!Process::run(['ffmpeg', '-version'])->successful()) {
            $this->markTestSkipped('ffmpeg is not installed');
        }
        Storage::fake('public');
        Storage::fake('banners');
    }

    /** Write a 1 s test clip to the private disk and return its path there. */
    private function clip(string $name, array $encode, string $size = '320x240'): string
    {
        $path = "templates/test/{$name}";
        $full = Storage::disk('banners')->path($path);
        @mkdir(dirname($full), 0755, true);
        $result = Process::run(array_merge(
            ['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', "testsrc2=size={$size}:rate=30:duration=1"],
            $encode,
            [$full]
        ));
        $this->assertTrue($result->successful(), $result->errorOutput());

        return $path;
    }

    private function probe(string $file): array
    {
        $out = Process::run([
            'ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name,pix_fmt,width,height,color_space,color_primaries,color_transfer,color_range',
            '-of', 'json', $file,
        ])->output();

        return json_decode($out, true)['streams'][0];
    }

    public function test_h264_yuv420p_upload_is_remuxed_bit_exact_with_bt709_tags(): void
    {
        $upload = $this->clip('upload-1.mp4', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
        $template = BannerTemplate::factory()->create(['upload_path' => $upload]);
        $uploadFrames = $this->frameHashes(Storage::disk('banners')->path($upload));

        (new ProcessBannerTemplate($template->id, $upload, 1))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();

        $this->assertSame(BannerTemplateStatus::Ready, $template->processing_status, (string) $template->processing_error);
        $this->assertSame(1, $template->source_rev);
        $this->assertSame([320, 240], [$template->width, $template->height]);
        $this->assertEqualsWithDelta(30, $template->fps, 0.01);
        $this->assertEqualsWithDelta(1, $template->duration, 0.05);
        Storage::disk('banners')->assertMissing($upload); // upload removed after success

        $master = Storage::disk('banners')->path($template->source_path);
        $info = $this->probe($master);
        $this->assertSame(['h264', 'yuv420p', 'bt709', 'bt709', 'bt709', 'tv'], [
            $info['codec_name'], $info['pix_fmt'], $info['color_space'], $info['color_primaries'], $info['color_transfer'], $info['color_range'],
        ]);

        // Not re-encoded: decoded frames are identical to the upload
        $this->assertCount(30, $uploadFrames);
        $this->assertSame($uploadFrames, $this->frameHashes($master));
    }

    /** @return string[] md5 of every decoded frame */
    private function frameHashes(string $file): array
    {
        $out = Process::run(['ffmpeg', '-v', 'error', '-i', $file, '-f', 'framemd5', '-'])->output();
        preg_match_all('/([0-9a-f]{32})\s*$/m', $out, $m);

        return $m[1];
    }

    public function test_other_formats_are_encoded_and_odd_sizes_cropped(): void
    {
        // yuv444 H.264 with an odd size can't be used as-is
        $upload = $this->clip('upload-1.mp4', ['-c:v', 'libx264', '-pix_fmt', 'yuv444p'], '321x241');
        $template = BannerTemplate::factory()->create(['upload_path' => $upload]);

        (new ProcessBannerTemplate($template->id, $upload, 1))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();

        $this->assertSame(BannerTemplateStatus::Ready, $template->processing_status, (string) $template->processing_error);
        $info = $this->probe(Storage::disk('banners')->path($template->source_path));
        $this->assertSame(['h264', 'yuv420p', 320, 240, 'bt709'], [
            $info['codec_name'], $info['pix_fmt'], $info['width'], $info['height'], $info['color_space'],
        ]);
    }

    public function test_preview_is_small_watermarked_tagged_and_public(): void
    {
        $upload = $this->clip('upload-1.mp4', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'], '1450x1694');
        $template = BannerTemplate::factory()->create(['upload_path' => $upload]);

        (new ProcessBannerTemplate($template->id, $upload, 1))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();

        Storage::disk('public')->assertExists([$template->preview_path, $template->poster_path]);
        $preview = $this->probe(Storage::disk('public')->path($template->preview_path));
        $this->assertSame([720, 842, 'bt709'], [$preview['width'], $preview['height'], $preview['color_space']]);
        $this->assertStringStartsWith('banners/templates/', $template->preview_path);
        $this->assertStringStartsWith('templates/', $template->source_path); // master stays private
    }

    public function test_watermark_rebuild_replaces_preview_and_keeps_master(): void
    {
        $upload = $this->clip('upload-1.mp4', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
        $template = BannerTemplate::factory()->create(['upload_path' => $upload]);
        (new ProcessBannerTemplate($template->id, $upload, 1))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();
        [$oldPreview, $master] = [$template->preview_path, $template->source_path];

        $template->update(['watermark' => ['text' => 'OTHER', 'opacity' => 60]]);
        (new ProcessBannerTemplate($template->id))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();

        $this->assertNotSame($oldPreview, $template->preview_path);
        Storage::disk('public')->assertMissing($oldPreview);
        Storage::disk('public')->assertExists($template->preview_path);
        $this->assertSame($master, $template->source_path);
    }

    public function test_broken_upload_fails_without_touching_current_media(): void
    {
        $template = BannerTemplate::factory()->published()->create();
        $before = $template->only(['source_path', 'preview_path', 'poster_path']);
        Storage::disk('banners')->put('templates/test/upload-2.mp4', 'not a video');
        $template->update(['upload_path' => 'templates/test/upload-2.mp4']);

        (new ProcessBannerTemplate($template->id, 'templates/test/upload-2.mp4', 2))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();

        $this->assertSame($before, $template->only(['source_path', 'preview_path', 'poster_path']));
        $this->assertSame(BannerTemplateStatus::Ready, $template->processing_status); // old version still served
        $this->assertStringStartsWith('New video was not applied', $template->processing_error);
        $this->assertNull($template->upload_path);
        Storage::disk('banners')->assertMissing('templates/test/upload-2.mp4');
    }

    public function test_limits_are_enforced(): void
    {
        config(['banners.template.max_duration' => 0.5]);
        $upload = $this->clip('upload-1.mp4', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
        $template = BannerTemplate::factory()->create(['upload_path' => $upload]);

        (new ProcessBannerTemplate($template->id, $upload, 1))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();

        $this->assertSame(BannerTemplateStatus::Failed, $template->processing_status);
        $this->assertStringContainsString('longer than', $template->processing_error);
    }

    public function test_watermark_png_is_transparent_with_requested_opacity(): void
    {
        $file = Storage::disk('banners')->path('wm.png');
        (new WatermarkGenerator())->png(400, 300, 'SMUZZIE  PREVIEW', 20, $file);

        $img = imagecreatefrompng($file);
        $this->assertSame([400, 300], [imagesx($img), imagesy($img)]);
        $minAlpha = 127;
        $transparent = 0;
        for ($x = 0; $x < 400; $x += 3) {
            for ($y = 0; $y < 300; $y += 3) {
                $a = (imagecolorat($img, $x, $y) >> 24) & 0x7F;
                $minAlpha = min($minAlpha, $a);
                $transparent += $a === 127 ? 1 : 0;
            }
        }
        // 20/255 opacity -> GD alpha 127 - round(20/255*127) = 117 at the most opaque pixels
        $this->assertSame(117, $minAlpha);
        $this->assertGreaterThan(0.6, $transparent / (134 * 100)); // mostly see-through
    }

    public function test_preview_size_never_upscales_and_stays_even(): void
    {
        $p = new TemplateMediaProcessor(new Ffmpeg(), new WatermarkGenerator());
        $this->assertSame([720, 842], $p->previewSize(1450, 1694));
        $this->assertSame([640, 360], $p->previewSize(640, 360));
        $this->assertSame([720, 406], $p->previewSize(1920, 1080)); // 405 -> nearest even
    }
}

<?php

namespace Tests\Feature\Banners;

use App\Enums\BannerOrderStatus;
use App\Jobs\ProcessBannerTemplate;
use App\Jobs\RenderBannerOrder;
use App\Mail\SiteMail;
use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Models\User;
use App\Services\Banners\BannerConfigValidator;
use App\Services\Banners\BannerOrderService;
use App\Services\Banners\BannerRenderer;
use App\Services\Banners\TemplateMediaProcessor;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/** Static templates: a PNG/JPG/WebP background, PNG + JPG results. */
class BannerImageTemplateTest extends TestCase
{
    use RefreshDatabase;

    private const SRGB = [[0.4361, 0.2225, 0.0139], [0.3851, 0.7169, 0.0971], [0.1431, 0.0606, 0.7141]];
    private const DISPLAY_P3 = [[0.5151, 0.2412, -0.0011], [0.2919, 0.6922, 0.0419], [0.1572, 0.0666, 0.7841]];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Storage::fake('public');
        Queue::fake();
    }

    private function admin(): void
    {
        $this->withHeader('Authorization', 'Bearer ' . JWTAuth::fromUser(User::factory()->create(['role' => 'admin'])));
    }

    // ─── Upload and processing ───────────────────────────────

    public function test_image_upload_is_accepted_and_queued(): void
    {
        $this->admin();
        $template = BannerTemplate::factory()->create();

        $this->post("/api/v1/admin/banner-templates/{$template->id}/source", [
            'file' => UploadedFile::fake()->image('background.jpg', 800, 400),
        ], ['Accept' => 'application/json'])->assertStatus(202);

        $template->refresh();
        $this->assertStringEndsWith('.jpg', $template->upload_path);
        Queue::assertPushed(ProcessBannerTemplate::class, fn ($job) => $job->uploadPath === $template->upload_path);
    }

    public function test_svg_background_is_rejected(): void
    {
        $this->admin();
        $template = BannerTemplate::factory()->create();
        $svg = UploadedFile::fake()->createWithContent('bg.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');

        $this->post("/api/v1/admin/banner-templates/{$template->id}/source", ['file' => $svg], ['Accept' => 'application/json'])
            ->assertStatus(422);
        Queue::assertNothingPushed();
    }

    public function test_png_becomes_an_opaque_srgb_master_with_watermarked_preview(): void
    {
        // A video template switching to an image: kind and outputs follow the upload
        $template = BannerTemplate::factory()->published()->create();
        $png = $this->png(1450, 800, transparentCorner: true, text: 'SECRET-METADATA-MARKER');
        $upload = $this->putUpload($template, 'upload-2.png', $png);

        (new ProcessBannerTemplate($template->id, $upload, 2))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();

        $this->assertSame('ready', $template->processing_status->value, (string) $template->processing_error);
        $this->assertSame('image', $template->kind);
        $this->assertSame([1450, 800], [$template->width, $template->height]);
        $this->assertNull($template->fps);
        $this->assertNull($template->duration);
        $this->assertNull($template->frame_count);
        $this->assertSame(['png' => true, 'jpg' => ['enabled' => true, 'quality' => 92]], $template->outputs);
        $this->assertSame(['png', 'jpg'], $template->formats());
        Storage::disk('banners')->assertMissing($upload);

        $master = Storage::disk('banners')->get($template->source_path);
        $this->assertStringStartsWith("\x89PNG", $master);
        $this->assertStringNotContainsString('SECRET-METADATA-MARKER', $master);
        $img = imagecreatefromstring($master);
        $corner = imagecolorsforindex($img, imagecolorat($img, 2, 2));
        $this->assertSame([0, 0, 0, 0], [$corner['red'], $corner['green'], $corner['blue'], $corner['alpha']]); // flattened onto black
        $center = imagecolorsforindex($img, imagecolorat($img, 725, 400));
        $this->assertSame([30, 60, 200], [$center['red'], $center['green'], $center['blue']]);

        $preview = Storage::disk('public')->get($template->preview_path);
        $this->assertStringEndsWith('.webp', $template->preview_path);
        $this->assertSame('WEBP', substr($preview, 8, 4));
        $this->assertSame([720, 398], array_slice(getimagesizefromstring($preview), 0, 2));
        Storage::disk('public')->assertExists($template->poster_path);
    }

    public function test_watermark_change_rebuilds_the_image_preview(): void
    {
        $template = BannerTemplate::factory()->create();
        $upload = $this->putUpload($template, 'upload-1.png', $this->png(400, 300));
        (new ProcessBannerTemplate($template->id, $upload, 1))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();
        [$oldPreview, $master] = [$template->preview_path, $template->source_path];

        $template->update(['watermark' => ['text' => 'OTHER', 'opacity' => 90]]);
        (new ProcessBannerTemplate($template->id))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();

        $this->assertSame('image', $template->kind);
        $this->assertNotSame($oldPreview, $template->preview_path);
        Storage::disk('public')->assertMissing($oldPreview);
        Storage::disk('public')->assertExists($template->preview_path);
        $this->assertSame($master, $template->source_path);
    }

    public function test_wide_gamut_image_is_rejected_srgb_profile_is_accepted(): void
    {
        $template = BannerTemplate::factory()->create();
        $p3 = $this->putUpload($template, 'upload-1.png', $this->withProfile($this->png(200, 100), self::DISPLAY_P3, 'Display P3'));
        (new ProcessBannerTemplate($template->id, $p3, 1))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();
        $this->assertSame('failed', $template->processing_status->value);
        $this->assertStringContainsString('Display P3', $template->processing_error);
        $this->assertNull($template->source_path);

        // Any vendor's sRGB profile is fine, whatever its name
        $srgb = $this->putUpload($template, 'upload-2.png', $this->withProfile($this->png(200, 100), self::SRGB, 'c2'));
        (new ProcessBannerTemplate($template->id, $srgb, 2))->handle(app(TemplateMediaProcessor::class));
        $template->refresh();
        $this->assertSame('ready', $template->processing_status->value, (string) $template->processing_error);
        $this->assertSame('image', $template->kind);
    }

    public function test_tiny_image_is_rejected(): void
    {
        $template = BannerTemplate::factory()->create();
        $upload = $this->putUpload($template, 'upload-1.png', $this->png(40, 40));
        (new ProcessBannerTemplate($template->id, $upload, 1))->handle(app(TemplateMediaProcessor::class));

        $this->assertStringContainsString('smaller than 64 px', $template->fresh()->processing_error);
    }

    // ─── Outputs ─────────────────────────────────────────────

    public function test_outputs_are_validated_by_kind(): void
    {
        $validator = new BannerConfigValidator();
        $this->assertSame(
            ['png' => true, 'jpg' => ['enabled' => false, 'quality' => 85]],
            $validator->validateOutputs(['png' => false, 'jpg' => ['enabled' => false, 'quality' => 85], 'gif' => ['enabled' => true]], 1200, 'image')
        );
        // Video templates are unchanged
        $this->assertSame(['mp4', 'gif'], array_keys($validator->validateOutputs(['jpg' => ['enabled' => true]], 1200, 'video')));

        $this->expectException(ValidationException::class);
        $validator->validateOutputs(['jpg' => ['enabled' => true, 'quality' => 30]], 1200, 'image');
    }

    public function test_admin_saves_image_outputs(): void
    {
        $this->admin();
        $template = BannerTemplate::factory()->image()->create();

        $this->putJson("/api/v1/admin/banner-templates/{$template->id}", ['outputs' => ['png' => true, 'jpg' => ['enabled' => false, 'quality' => 90]]])
            ->assertOk()
            ->assertJsonPath('kind', 'image')
            ->assertJsonPath('outputs.jpg.enabled', false)
            ->assertJsonPath('formats', ['png']);
    }

    public function test_catalog_exposes_kind_and_formats(): void
    {
        $image = BannerTemplate::factory()->image()->create(['sort_order' => 1]);
        BannerTemplate::factory()->published()->create(['sort_order' => 2]);

        $this->getJson('/api/v1/banners/templates')
            ->assertOk()
            ->assertJsonPath('0.kind', 'image')
            ->assertJsonPath('0.formats', ['png', 'jpg'])
            ->assertJsonPath('0.duration', null)
            ->assertJsonPath('1.kind', 'video')
            ->assertJsonPath('1.formats', ['mp4']);

        $this->getJson("/api/v1/banners/templates/{$image->slug}")->assertOk()->assertJsonPath('kind', 'image')->assertJsonPath('fps', null);
    }

    // ─── Orders ──────────────────────────────────────────────

    public function test_order_renders_png_and_jpg_and_downloads_them(): void
    {
        $font = BannerFont::factory()->create();
        Storage::disk('public')->put($font->path, 'wOF2font');
        $template = BannerTemplate::factory()->image()->create(['config' => BannerTemplateFactory::sampleConfig($font->id)]);
        Storage::disk('banners')->put($template->source_path, 'MASTERPNG');

        $orders = app(BannerOrderService::class);
        $order = $orders->create($template, 'buyer@example.com', ['schemaVersion' => 1, 'hue' => 90, 'zones' => []], [], '127.0.0.1');
        $this->assertSame('image', $order->snapshot['kind']);
        $this->assertSame('PNG and JPG', SiteMail::formats($order));
        $this->getJson("/api/v1/banners/orders/{$order->token}")
            ->assertJsonPath('kind', 'image')
            ->assertJsonPath('formats', ['png', 'jpg']);
        $orders->markPaid($order, 'manual');

        Process::fake(function (PendingProcess $process) use (&$job) {
            $job = json_decode(file_get_contents(end($process->command)), true);
            @mkdir($job['workDir'], 0755, true);
            file_put_contents($job['workDir'] . '/banner.png', 'PNGDATA');
            file_put_contents($job['workDir'] . '/banner.jpg', 'JPGDATA');
            return Process::result(json_encode([
                'ok' => true,
                'png' => ['path' => $job['workDir'] . '/banner.png', 'size' => 7],
                'jpg' => ['path' => $job['workDir'] . '/banner.jpg', 'size' => 7],
                'hue' => 90, 'timings' => [], 'fit' => [],
            ]) . "\n");
        });
        (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), app(BannerOrderService::class));
        $order->refresh();

        $this->assertSame('image', $job['kind']);
        $this->assertSame(['png' => true, 'jpg' => ['enabled' => true, 'quality' => 92]], $job['outputs']);
        $this->assertSame(BannerOrderStatus::Ready, $order->status, (string) $order->error);
        $this->assertSame(['png', 'jpg'], $order->resultFormats());

        $links = $this->getJson("/api/v1/banners/orders/{$order->token}")->json('downloads');
        $this->assertSame(['png', 'jpg'], array_keys($links));
        $png = $this->get($links['png'])->assertOk();
        $this->assertSame('image/png', $png->headers->get('Content-Type'));
        $this->assertStringContainsString('.png', $png->headers->get('Content-Disposition'));
        $this->assertSame('image/jpeg', $this->get($links['jpg'])->assertOk()->headers->get('Content-Type'));

        // A format the order doesn't have is a 404 even with a valid signature
        $mp4 = URL::temporarySignedRoute('banners.download', now()->addDay(), ['token' => $order->token, 'format' => 'mp4']);
        $this->get($mp4)->assertNotFound();

        // Expired results are purged like videos
        $order->update(['ready_at' => now()->subDays(40)]);
        $this->artisan('banners:cleanup')->assertSuccessful();
        Storage::disk('banners')->assertMissing(["orders/{$order->token}/banner.png", "orders/{$order->token}/banner.jpg"]);
    }

    public function test_a_render_without_the_png_fails(): void
    {
        $template = BannerTemplate::factory()->image()->create();
        Storage::disk('banners')->put($template->source_path, 'MASTERPNG');
        $orders = app(BannerOrderService::class);
        $order = $orders->create($template, 'buyer@example.com', ['schemaVersion' => 1, 'hue' => 0, 'zones' => []], [], '127.0.0.1');
        $orders->markPaid($order, 'manual');
        foreach ($order->snapshot['fonts'] as $font) {
            Storage::disk('public')->put($font['path'], 'wOF2font');
        }

        Process::fake(fn () => Process::result(json_encode(['ok' => true, 'mp4' => null, 'hue' => 0]) . "\n"));
        $this->expectExceptionMessage('produced no PNG');
        app(BannerRenderer::class)->render($order->fresh());
    }

    public function test_old_snapshots_without_kind_are_videos(): void
    {
        $order = new BannerOrder(['snapshot' => ['outputs' => ['mp4' => true, 'gif' => ['enabled' => true]]]]);
        $this->assertSame('video', $order->kind());
        $this->assertSame('MP4 and GIF', SiteMail::formats($order));
    }

    // ─── Helpers ─────────────────────────────────────────────

    private function putUpload(BannerTemplate $template, string $name, string $bytes): string
    {
        $path = "templates/{$template->uuid}/{$name}";
        Storage::disk('banners')->put($path, $bytes);
        $template->update(['upload_path' => $path]);
        return $path;
    }

    /** Blue PNG; optionally a transparent top-left corner and a tEXt chunk. */
    private function png(int $w, int $h, bool $transparentCorner = false, ?string $text = null): string
    {
        $img = imagecreatetruecolor($w, $h);
        imagealphablending($img, false);
        imagesavealpha($img, true);
        imagefill($img, 0, 0, imagecolorallocatealpha($img, 30, 60, 200, 0));
        if ($transparentCorner) {
            imagefilledrectangle($img, 0, 0, 9, 9, imagecolorallocatealpha($img, 255, 255, 255, 127));
        }
        ob_start();
        imagepng($img);
        $png = ob_get_clean();
        imagedestroy($img);

        return $text === null ? $png : $this->insertChunk($png, 'tEXt', "Comment\0" . $text);
    }

    private function withProfile(string $png, array $colorants, string $name): string
    {
        return $this->insertChunk($png, 'iCCP', "icc\0\0" . gzcompress($this->icc($colorants, $name)));
    }

    /** A chunk right after IHDR (8 signature + 25 IHDR bytes). */
    private function insertChunk(string $png, string $type, string $data): string
    {
        $chunk = pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
        return substr($png, 0, 33) . $chunk . substr($png, 33);
    }

    /** Minimal RGB display profile: description and the three colorant tags. */
    private function icc(array $colorants, string $name): string
    {
        $xyz = fn (array $v) => 'XYZ ' . "\0\0\0\0" . implode('', array_map(fn ($n) => pack('N', (int) round($n * 65536) & 0xFFFFFFFF), $v));
        $tags = [
            'desc' => 'desc' . "\0\0\0\0" . pack('N', strlen($name) + 1) . $name . "\0",
            'rXYZ' => $xyz($colorants[0]),
            'gXYZ' => $xyz($colorants[1]),
            'bXYZ' => $xyz($colorants[2]),
        ];
        $offset = 128 + 4 + 12 * count($tags);
        $table = pack('N', count($tags));
        $data = '';
        foreach ($tags as $sig => $bytes) {
            $bytes = str_pad($bytes, (int) ceil(strlen($bytes) / 4) * 4, "\0");
            $table .= $sig . pack('NN', $offset + strlen($data), strlen($bytes));
            $data .= $bytes;
        }
        $header = str_pad(pack('N', 128 + strlen($table) + strlen($data)) . 'none' . "\x02\x10\0\0" . 'mntr' . 'RGB ' . 'XYZ ', 36, "\0") . 'acsp';

        return str_pad($header, 128, "\0") . $table . $data;
    }
}

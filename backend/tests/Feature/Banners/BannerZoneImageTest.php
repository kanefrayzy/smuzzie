<?php

namespace Tests\Feature\Banners;

use App\Jobs\RenderBannerOrder;
use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Models\User;
use App\Services\Banners\BannerConfigValidator;
use App\Services\Banners\BannerOrderService;
use App\Services\Banners\BannerRenderer;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/** A template's own images in image zones (icons, logos) and the buyer removing them. */
class BannerZoneImageTest extends TestCase
{
    use RefreshDatabase;

    private BannerFont $font;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Storage::fake('public');
        Queue::fake();
        $this->font = BannerFont::factory()->create();
        Storage::disk('public')->put($this->font->path, 'wOF2font');
    }

    private function uploadIcon(BannerTemplate $template)
    {
        $token = JWTAuth::fromUser(User::factory()->admin()->create());

        return $this->withHeader('Authorization', "Bearer {$token}")->post(
            "/api/v1/admin/banner-templates/{$template->id}/zone-image",
            ['file' => UploadedFile::fake()->image('star.png', 800, 800), 'w' => 8, 'h' => 7],
            ['Accept' => 'application/json'],
        );
    }

    /** Sample config with the logo zone showing an image of its own and removable. */
    private function config(?string $image, bool $removable = true): array
    {
        $config = BannerTemplateFactory::sampleConfig($this->font->id);
        $config['zones'][0]['style']['image'] = $image;
        $config['zones'][0]['controls']['visible'] = ['enabled' => $removable];
        return $config;
    }

    public function test_admin_uploads_a_zone_image_to_the_public_disk(): void
    {
        $template = BannerTemplate::factory()->published()->create();

        $res = $this->uploadIcon($template)->assertOk();

        $path = $res->json('path');
        $this->assertMatchesRegularExpression(BannerConfigValidator::ZONE_IMAGE_PATTERN, $path);
        Storage::disk('public')->assertExists($path);
        // Re-encoded and scaled to twice the zone at the template size (8% of 1450 px × 2)
        [$w] = getimagesizefromstring(Storage::disk('public')->get($path));
        $this->assertSame(232, $w);
        $this->assertStringEndsWith($path, $res->json('url'));
    }

    public function test_zone_image_upload_rejects_non_images(): void
    {
        $template = BannerTemplate::factory()->published()->create();
        $token = JWTAuth::fromUser(User::factory()->admin()->create());

        $this->withHeader('Authorization', "Bearer {$token}")->post(
            "/api/v1/admin/banner-templates/{$template->id}/zone-image",
            ['file' => UploadedFile::fake()->createWithContent('x.png', '<svg/>'), 'w' => 8, 'h' => 7],
            ['Accept' => 'application/json'],
        )->assertStatus(422)->assertJsonValidationErrors('file');
    }

    public function test_config_keeps_an_existing_image_and_rejects_others(): void
    {
        Storage::disk('public')->put('banners/zone-images/abcdef12-3456.png', 'PNG');
        $out = (new BannerConfigValidator())->validate($this->config('banners/zone-images/abcdef12-3456.png'));
        $this->assertSame('banners/zone-images/abcdef12-3456.png', $out['zones'][0]['style']['image']);
        $this->assertTrue($out['zones'][0]['controls']['visible']['enabled']);

        // No image: the key is left out
        $out = (new BannerConfigValidator())->validate($this->config(null, false));
        $this->assertArrayNotHasKey('image', $out['zones'][0]['style']);
        $this->assertFalse($out['zones'][0]['controls']['visible']['enabled']);

        foreach (['banners/zone-images/missing-0000.png', '../../.env', 'fonts/abc.woff2'] as $bad) {
            try {
                (new BannerConfigValidator())->validate($this->config($bad));
                $this->fail("Accepted {$bad}");
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('config.zones.0.style.image', $e->errors());
            }
        }
    }

    private function template(bool $removable = true): BannerTemplate
    {
        Storage::disk('public')->put('banners/zone-images/abcdef12-3456.png', 'PNG');
        $template = BannerTemplate::factory()->published()->create([
            'slug' => 'neon',
            'config' => (new BannerConfigValidator())->validate($this->config('banners/zone-images/abcdef12-3456.png', $removable)),
        ]);
        Storage::disk('banners')->put($template->source_path, 'MASTER');
        return $template;
    }

    public function test_buyer_can_remove_the_image_only_when_allowed(): void
    {
        $this->template();
        $order = fn () => $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['schemaVersion' => 1, 'hue' => 0, 'zones' => ['logo' => ['visible' => false]]]),
        ], ['Accept' => 'application/json']);

        $order()->assertCreated();
        $this->assertFalse(BannerOrder::firstOrFail()->params['zones']['logo']['visible']);

        // Not removable: the value is ignored
        BannerOrder::query()->delete();
        BannerTemplate::query()->forceDelete();
        $this->template(false);
        $order()->assertCreated();
        $this->assertArrayNotHasKey('visible', BannerOrder::firstOrFail()->params['zones']['logo'] ?? []);
    }

    public function test_render_uses_the_template_image_unless_the_buyer_uploaded_one(): void
    {
        $template = $this->template();
        $jobs = [];
        Process::fake(function (PendingProcess $process) use (&$jobs) {
            $job = json_decode(file_get_contents(end($process->command)), true);
            $jobs[] = $job;
            @mkdir($job['workDir'], 0755, true);
            file_put_contents($job['workDir'] . '/banner.mp4', 'MP4DATA');
            return Process::result(json_encode(['ok' => true, 'mp4' => ['path' => $job['workDir'] . '/banner.mp4', 'size' => 7]]) . "\n");
        });
        $service = app(BannerOrderService::class);
        $render = function (array $images) use ($service, $template) {
            $order = $service->create($template, 'buyer@example.com', ['schemaVersion' => 1, 'hue' => 0, 'zones' => []], $images, '127.0.0.1');
            $service->markPaid($order, 'manual');
            (new RenderBannerOrder($order->id))->handle(app(BannerRenderer::class), $service);
            return $order->fresh();
        };

        $render([]);
        $this->assertSame(Storage::disk('public')->path('banners/zone-images/abcdef12-3456.png'), $jobs[0]['images']['logo']);

        $order = $render(['logo' => UploadedFile::fake()->image('mine.png', 200, 50)]);
        $this->assertSame(Storage::disk('banners')->path($order->images['logo']), $jobs[1]['images']['logo']);
    }
}

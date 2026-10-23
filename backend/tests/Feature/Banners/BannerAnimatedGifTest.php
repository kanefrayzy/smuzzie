<?php

namespace Tests\Feature\Banners;

use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use App\Services\Banners\BannerConfigValidator;
use App\Services\Banners\GifInfo;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/** Animated GIF logos and icons: validated from the structure, re-encoded by ffmpeg, kept animated. */
class BannerAnimatedGifTest extends TestCase
{
    use RefreshDatabase;

    private array $config;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Queue::fake();
        $font = BannerFont::factory()->create();
        $this->config = BannerTemplateFactory::sampleConfig($font->id);
        BannerTemplate::factory()->published()->create(['slug' => 'neon', 'config' => $this->config]);
    }

    private function needFfmpeg(): void
    {
        if (!Process::run(['ffmpeg', '-version'])->successful()) {
            $this->markTestSkipped('ffmpeg is not installed');
        }
    }

    /** An animated test GIF made by ffmpeg (frames at 10 fps). */
    private function gif(int $w = 120, int $h = 120, int $frames = 10): string
    {
        $file = tempnam(sys_get_temp_dir(), 'gif') . '.gif';
        $r = Process::run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', "testsrc2=s={$w}x{$h}:r=10", '-frames:v', (string) $frames, '-loop', '0', $file]);
        $this->assertTrue($r->successful(), $r->errorOutput());
        $data = file_get_contents($file);
        @unlink($file);
        return $data;
    }

    private function order(array $images, array $params = [])
    {
        return $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['schemaVersion' => 1, 'hue' => 0, 'zones' => []] + $params),
            'images' => $images,
        ], ['Accept' => 'application/json']);
    }

    public function test_animated_gif_is_reencoded_and_stays_animated(): void
    {
        $this->needFfmpeg();
        $upload = UploadedFile::fake()->createWithContent('icon.gif', $this->gif() . 'APPENDED-PAYLOAD-MARKER');

        $this->order(['logo' => $upload])->assertCreated();

        $order = BannerOrder::firstOrFail();
        $this->assertStringEndsWith('/image-logo.gif', $order->images['logo']);
        $stored = Storage::disk('banners')->get($order->images['logo']);
        $this->assertStringStartsWith('GIF89a', $stored);
        $this->assertStringNotContainsString('APPENDED-PAYLOAD-MARKER', $stored);
        $info = GifInfo::read($stored);
        $this->assertSame(10, $info['frames']);
        $this->assertEqualsWithDelta(1.0, $info['duration'], 0.01); // timing kept
        $this->assertSame([120, 120], [$info['width'], $info['height']]);

        // The admin's signed link serves it as a GIF
        $url = URL::temporarySignedRoute('banners.image', now()->addHour(), ['token' => $order->token, 'key' => 'logo']);
        $this->assertSame('image/gif', $this->get($url)->assertOk()->headers->get('Content-Type'));
    }

    public function test_large_gif_is_scaled_to_twice_the_zone(): void
    {
        $this->needFfmpeg();
        // The logo zone is 40% x 5.6% of 1450x1694: twice that is 1160x189.7 px
        $this->order(['logo' => UploadedFile::fake()->createWithContent('logo.gif', $this->gif(800, 400, 3))])->assertCreated();

        $info = GifInfo::read(Storage::disk('banners')->get(BannerOrder::firstOrFail()->images['logo']));
        $this->assertSame(3, $info['frames']);
        $this->assertSame([379, 190], [$info['width'], $info['height']]);
    }

    public function test_single_frame_gif_becomes_a_png(): void
    {
        $this->needFfmpeg();
        $this->order(['logo' => UploadedFile::fake()->createWithContent('logo.gif', $this->gif(60, 30, 1))])->assertCreated();

        $order = BannerOrder::firstOrFail();
        $this->assertStringEndsWith('.png', $order->images['logo']);
        $this->assertStringStartsWith("\x89PNG", Storage::disk('banners')->get($order->images['logo']));
    }

    public function test_fake_and_malformed_gifs_are_rejected(): void
    {
        $text = UploadedFile::fake()->createWithContent('icon.gif', "NOT-AN-IMAGE just some text\n");
        $this->order(['logo' => $text])->assertStatus(422)->assertJsonValidationErrors('images.logo');

        // A GIF header with a frame that lies outside its 10x10 canvas
        $broken = 'GIF89a' . pack('vvCCC', 10, 10, 0, 0, 0)
            . "\x2C" . pack('vvvvC', 0, 0, 5000, 5000, 0) . "\x02\x01\x00" . "\x2C" . pack('vvvvC', 0, 0, 5000, 5000, 0) . "\x02\x01\x00\x3B";
        $this->order(['logo' => UploadedFile::fake()->createWithContent('icon.gif', $broken)])
            ->assertStatus(422)->assertJsonValidationErrors('images.logo');
        $this->assertSame(0, BannerOrder::count());
    }

    public function test_limits_on_frames_duration_and_size(): void
    {
        $this->needFfmpeg();

        config(['banners.logo.gif.max_frames' => 5]);
        $this->order(['logo' => UploadedFile::fake()->createWithContent('a.gif', $this->gif())])
            ->assertStatus(422)->assertJsonFragment(['The GIF has too many frames; up to 5']);

        config(['banners.logo.gif.max_frames' => 300, 'banners.logo.gif.max_duration' => 0.5]);
        $this->order(['logo' => UploadedFile::fake()->createWithContent('a.gif', $this->gif())])
            ->assertStatus(422)->assertJsonFragment(['The GIF is too long; up to 0.5 seconds']);

        config(['banners.logo.gif.max_duration' => 20]);
        $this->order(['logo' => UploadedFile::fake()->createWithContent('a.gif', $this->gif(1100, 40, 2))])
            ->assertStatus(422)->assertJsonValidationErrors('images.logo');

        config(['banners.logo.gif.max_total_pixels' => 100_000]);
        $this->order(['logo' => UploadedFile::fake()->createWithContent('a.gif', $this->gif())])
            ->assertStatus(422)->assertJsonFragment(['The animated GIF is too heavy: use fewer frames or a smaller size']);

        $this->assertSame(0, BannerOrder::count());
    }

    public function test_gif_reencode_is_time_limited(): void
    {
        $this->needFfmpeg();
        $gif = $this->gif();
        Process::fake(['*' => Process::result('', 'killed: timeout', 1)]);

        $this->order(['logo' => UploadedFile::fake()->createWithContent('a.gif', $gif)])
            ->assertStatus(422)->assertJsonFragment(['The GIF could not be processed']);
        Process::assertRan(fn ($p) => in_array('-f', $p->command, true) && $p->timeout === 30);
    }

    public function test_up_to_twelve_image_zones_with_gif_icons(): void
    {
        $this->needFfmpeg();
        config(['banners.template.max_image_zones' => 12]); // the limit itself is env (40 by default)
        $icon = fn (int $i) => [
            'key' => "icon_{$i}", 'type' => 'image', 'label' => "Icon {$i}",
            'x' => ($i % 4) * 25, 'y' => 50 + intdiv($i, 4) * 10, 'w' => 8, 'h' => 6,
            'style' => ['scale' => 100, 'alignX' => 'center', 'alignY' => 'center'],
            'controls' => ['upload' => ['enabled' => true]],
        ];
        $config = $this->config;
        for ($i = 0; $i < 11; $i++) {
            $config['zones'][] = $icon($i);
        }
        $validator = new BannerConfigValidator();
        $normalized = $validator->validate($config); // logo + 11 icons = 12 image zones
        $this->assertCount(14, $normalized['zones']);

        $config['zones'][] = $icon(11);
        try {
            $validator->validate($config);
            $this->fail('13 image zones must be rejected');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('config.zones', $e->errors());
        }

        BannerTemplate::where('slug', 'neon')->update(['config' => json_encode($normalized)]);
        $gif = $this->gif(64, 64, 4);
        $images = ['logo' => UploadedFile::fake()->image('logo.png', 200, 50)];
        for ($i = 0; $i < 11; $i++) {
            $images["icon_{$i}"] = UploadedFile::fake()->createWithContent("icon{$i}.gif", $gif);
        }
        $this->order($images)->assertCreated();

        $stored = BannerOrder::firstOrFail()->images;
        $this->assertCount(12, $stored);
        $this->assertStringEndsWith('.gif', $stored['icon_10']);
        $this->assertStringEndsWith('.png', $stored['logo']);
    }

    public function test_buyer_image_layers_accept_gifs(): void
    {
        $this->needFfmpeg();
        $config = $this->config;
        $config['custom'] = ['enabled' => true, 'maxText' => 0, 'maxImage' => 2, 'fonts' => [], 'bounds' => ['x' => 0, 'y' => 0, 'w' => 100, 'h' => 100]];
        BannerTemplate::where('slug', 'neon')->update(['config' => json_encode((new BannerConfigValidator())->validate($config))]);

        $this->order(
            ['layer_1' => UploadedFile::fake()->createWithContent('sticker.gif', $this->gif(100, 100, 3))],
            ['layers' => [['id' => 'layer_1', 'type' => 'image', 'rect' => ['x' => 10, 'y' => 10, 'w' => 20, 'h' => 12]]]]
        )->assertCreated();

        $order = BannerOrder::firstOrFail();
        $this->assertStringEndsWith('/image-layer_1.gif', $order->images['layer_1']);
        $this->assertSame('layer_1', $order->params['layers'][0]['id']);
    }
}

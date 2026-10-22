<?php

namespace Tests\Feature\Banners;

use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BannerLogoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Queue::fake();
        $font = BannerFont::factory()->create();
        BannerTemplate::factory()->published()->create(['slug' => 'neon', 'config' => BannerTemplateFactory::sampleConfig($font->id)]);
    }

    private function upload(UploadedFile $file)
    {
        return $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['schemaVersion' => 1, 'hue' => 0, 'zones' => []]),
            'images' => ['logo' => $file],
        ], ['Accept' => 'application/json']);
    }

    private function storedLogo(): string
    {
        $order = BannerOrder::firstOrFail();
        return Storage::disk('banners')->get($order->images['logo']);
    }

    /** @dataProvider imageTypes */
    public function test_png_jpg_webp_are_reencoded_to_png(string $name): void
    {
        $this->upload(UploadedFile::fake()->image($name, 300, 120))->assertCreated();

        $data = $this->storedLogo();
        $this->assertStringStartsWith("\x89PNG", $data);
        $this->assertSame([300, 120], array_slice(getimagesizefromstring($data), 0, 2));
    }

    public static function imageTypes(): array
    {
        return [['logo.png'], ['logo.jpg'], ['logo.webp']];
    }

    public function test_svg_is_rejected(): void
    {
        $svg = UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
        $this->upload($svg)->assertStatus(422)->assertJsonValidationErrors('images.logo');
        $this->assertSame(0, BannerOrder::count());
    }

    public function test_text_disguised_as_png_is_rejected(): void
    {
        // Plain text with a .png name (neutral content: antivirus scanners flag real webshell strings)
        $fake = UploadedFile::fake()->createWithContent('logo.png', "NOT-AN-IMAGE just some text\n");
        $this->upload($fake)->assertStatus(422)->assertJsonValidationErrors('images.logo');
    }

    public function test_appended_payload_is_stripped_by_reencoding(): void
    {
        $png = UploadedFile::fake()->image('logo.png', 50, 50);
        $polyglot = file_get_contents($png->getRealPath()) . 'APPENDED-PAYLOAD-MARKER';
        $file = UploadedFile::fake()->createWithContent('logo.png', $polyglot);

        $this->upload($file)->assertCreated();
        $this->assertStringNotContainsString('APPENDED-PAYLOAD-MARKER', $this->storedLogo());
    }

    public function test_files_over_2mb_are_rejected(): void
    {
        $big = UploadedFile::fake()->create('logo.png', 2100, 'image/png');
        $this->upload($big)->assertStatus(422);
    }

    public function test_pixel_limits_are_checked_before_decoding(): void
    {
        config(['banners.logo.max_side' => 1000]);
        $this->upload(UploadedFile::fake()->image('wide.png', 1200, 10))
            ->assertStatus(422)->assertJsonValidationErrors('images.logo');
    }

    public function test_huge_logos_are_scaled_down_to_twice_the_zone(): void
    {
        // Logo zone: 40% x 5.6% of 1450x1694 => 580 x 94.9 px, so at most 1160 x 189.7
        $this->upload(UploadedFile::fake()->image('logo.png', 3000, 300))->assertCreated();

        [$w, $h] = getimagesizefromstring($this->storedLogo());
        $this->assertLessThanOrEqual(1160, $w);
        $this->assertLessThanOrEqual(190, $h);
        $this->assertEqualsWithDelta(10, $w / $h, 0.1); // aspect ratio kept
    }

    public function test_image_for_unknown_zone_is_ignored(): void
    {
        $this->post('/api/v1/banners/orders', [
            'template' => 'neon',
            'email' => 'buyer@example.com',
            'params' => json_encode(['schemaVersion' => 1, 'hue' => 0, 'zones' => []]),
            'images' => ['title' => UploadedFile::fake()->image('x.png', 10, 10)],
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame([], BannerOrder::firstOrFail()->images);
    }
}

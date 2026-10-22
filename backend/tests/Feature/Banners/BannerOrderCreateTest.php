<?php

namespace Tests\Feature\Banners;

use App\Enums\BannerOrderStatus;
use App\Jobs\RenderBannerOrder;
use App\Models\BannerFont;
use App\Models\BannerOrder;
use App\Models\BannerTemplate;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BannerOrderCreateTest extends TestCase
{
    use RefreshDatabase;

    private BannerTemplate $template;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('banners');
        Queue::fake();
        $font = BannerFont::factory()->create();
        $this->template = BannerTemplate::factory()->published()->create([
            'slug' => 'neon',
            'price' => 15,
            'config' => BannerTemplateFactory::sampleConfig($font->id),
        ]);
    }

    private function order(array $params, array $extra = [], array $headers = [])
    {
        return $this->post('/api/v1/banners/orders', array_merge([
            'template' => 'neon',
            'email' => 'Buyer@Example.com',
            'params' => json_encode($params),
        ], $extra), array_merge(['Accept' => 'application/json'], $headers));
    }

    private function validParams(): array
    {
        return [
            'schemaVersion' => 1,
            'hue' => 150,
            'zones' => [
                'title' => ['text' => 'Nova Pay', 'size' => 5.0, 'color' => '#1e9bff', 'align' => 'left', 'visible' => true],
                'logo' => ['scale' => 80, 'alignX' => 'left', 'alignY' => 'center'],
            ],
        ];
    }

    public function test_creates_pending_order_with_normalized_params_and_full_snapshot(): void
    {
        $response = $this->order($this->validParams(), ['images' => ['logo' => UploadedFile::fake()->image('logo.png', 400, 100)]]);

        $response->assertCreated()
            ->assertJsonPath('status', 'pending_payment')
            ->assertJsonPath('template.slug', 'neon')
            ->assertJsonPath('downloads', null)
            ->assertJsonMissingPath('params')
            ->assertJsonMissingPath('snapshot');

        $order = BannerOrder::firstOrFail();
        $this->assertSame('buyer@example.com', $order->email);
        $this->assertSame(BannerOrderStatus::PendingPayment, $order->status);
        $this->assertSame('15.00', $order->amount);
        // assertEquals: JSON storage turns 5.0 into 5
        $this->assertEquals([
            'schemaVersion' => 1,
            'hue' => 150,
            'zones' => [
                'logo' => ['scale' => 80, 'alignX' => 'left', 'alignY' => 'center'],
                'title' => ['text' => 'Nova Pay', 'size' => 5.0, 'color' => '#1e9bff', 'align' => 'left', 'visible' => true],
            ],
        ], $order->params);

        // Full snapshot: template identity, config with its schema version, outputs, media, fonts
        $this->assertSame(1, $order->snapshot['snapshotVersion']);
        $this->assertSame('neon', $order->snapshot['template']['slug']);
        $this->assertSame(1, $order->snapshot['config']['schemaVersion']);
        $this->assertSame($this->template->source_path, $order->snapshot['media']['source_path']);
        $this->assertCount(1, $order->snapshot['fonts']);
        $this->assertArrayHasKey('path', $order->snapshot['fonts'][0]);

        Storage::disk('banners')->assertExists($order->images['logo']);
        Queue::assertNothingPushed(); // waits for payment
    }

    public function test_later_template_edits_do_not_change_the_order(): void
    {
        $this->order($this->validParams())->assertCreated();
        $config = $this->template->config;
        $config['zones'][1]['style']['size'] = 9;
        $this->template->update(['config' => $config, 'name' => 'Renamed']);

        $order = BannerOrder::firstOrFail();
        $this->assertSame(4.4, (float) $order->snapshot['config']['zones'][1]['style']['size']);
        $this->assertNotSame('Renamed', $order->snapshot['template']['name']);
    }

    public function test_auto_approve_sends_the_order_to_the_render_queue(): void
    {
        config(['banners.auto_approve' => true]);

        $this->order($this->validParams())->assertCreated()->assertJsonPath('status', 'queued');

        $order = BannerOrder::firstOrFail();
        $this->assertSame('auto', $order->payment_provider);
        $this->assertNotNull($order->paid_at);
        Queue::assertPushed(RenderBannerOrder::class, fn ($job) => $job->orderId === $order->id && $job->queue === 'banners');
    }

    public function test_unknown_keys_and_disabled_controls_are_dropped(): void
    {
        $params = $this->validParams();
        $params['zones']['hacker'] = ['text' => '<script>alert(1)</script>'];
        $params['zones']['title']['fontId'] = 999;               // not a buyer control
        $params['zones']['title']['onload'] = 'x';
        $params['zones']['button'] = [                            // size/color/align/visible are off for the button
            'text' => 'Go', 'size' => 30, 'color' => '#000000', 'align' => 'left', 'visible' => false,
        ];
        $params['__proto__'] = ['polluted' => true];

        $this->order($params)->assertCreated();

        $saved = BannerOrder::firstOrFail()->params;
        $this->assertSame(['logo', 'title', 'button'], array_keys($saved['zones']));
        $this->assertSame(['text' => 'Go'], $saved['zones']['button']);
        $this->assertArrayNotHasKey('fontId', $saved['zones']['title']);
        $this->assertArrayNotHasKey('onload', $saved['zones']['title']);
        $this->assertArrayNotHasKey('__proto__', $saved);
    }

    /** @dataProvider invalidParams */
    public function test_invalid_values_are_rejected(callable $mutate, string $errorKey): void
    {
        $params = $this->validParams();
        $mutate($params);

        $this->order($params)->assertStatus(422)->assertJsonValidationErrors($errorKey);
        $this->assertSame(0, BannerOrder::count());
    }

    public static function invalidParams(): array
    {
        return [
            'text too long (characters, not bytes)' => [fn (&$p) => $p['zones']['title']['text'] = str_repeat('Я', 33), 'params.zones.title.text'],
            'line break in a single-line field' => [fn (&$p) => $p['zones']['title']['text'] = "Nova\nPay", 'params.zones.title.text'],
            'text is not a string' => [fn (&$p) => $p['zones']['title']['text'] = ['x'], 'params.zones.title.text'],
            'size above the max' => [fn (&$p) => $p['zones']['title']['size'] = 6.5, 'params.zones.title.size'],
            'size below the min' => [fn (&$p) => $p['zones']['title']['size'] = 1, 'params.zones.title.size'],
            'size as a string' => [fn (&$p) => $p['zones']['title']['size'] = '5', 'params.zones.title.size'],
            'bad hex color' => [fn (&$p) => $p['zones']['title']['color'] = 'red', 'params.zones.title.color'],
            'css injection as color' => [fn (&$p) => $p['zones']['title']['color'] = '#fff;background:url(x)', 'params.zones.title.color'],
            'align not allowed' => [fn (&$p) => $p['zones']['title']['align'] = 'justify', 'params.zones.title.align'],
            'visible not boolean' => [fn (&$p) => $p['zones']['title']['visible'] = 'no', 'params.zones.title.visible'],
            'hue out of range' => [fn (&$p) => $p['hue'] = 400, 'params.hue'],
            'hue negative' => [fn (&$p) => $p['hue'] = -5, 'params.hue'],
            'logo scale out of range' => [fn (&$p) => $p['zones']['logo']['scale'] = 5, 'params.zones.logo.scale'],
            'logo align not allowed' => [fn (&$p) => $p['zones']['logo']['alignY'] = 'middle', 'params.zones.logo.alignY'],
            'zone value not an object' => [fn (&$p) => $p['zones']['title'] = 'Nova', 'params.zones.title'],
        ];
    }

    public function test_color_outside_palette_rejected_when_custom_colors_are_off(): void
    {
        $config = $this->template->config;
        $config['zones'][1]['controls']['color']['custom'] = false;
        $this->template->update(['config' => $config]);

        $params = $this->validParams();
        $params['zones']['title']['color'] = '#123456';
        $this->order($params)->assertStatus(422)->assertJsonValidationErrors('params.zones.title.color');

        $params['zones']['title']['color'] = '#ffd400'; // in the palette
        $this->order($params)->assertCreated();
    }

    public function test_request_level_validation(): void
    {
        $this->order($this->validParams(), ['email' => 'not-an-email'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->order($this->validParams(), ['params' => '{broken json'])->assertStatus(422)->assertJsonValidationErrors('params');
        $this->order($this->validParams(), ['template' => 'missing'])->assertStatus(422)->assertJsonValidationErrors('template');

        $this->template->update(['is_active' => false]);
        $this->order($this->validParams())->assertStatus(422)->assertJsonValidationErrors('template');
    }

    public function test_orders_are_rate_limited_per_ip(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->order($this->validParams())->assertCreated();
        }
        $this->order($this->validParams())->assertStatus(429);
        $this->assertSame(5, BannerOrder::count());
    }

    public function test_status_page_by_token(): void
    {
        $token = $this->order($this->validParams())->json('token');

        $this->getJson("/api/v1/banners/orders/{$token}")
            ->assertOk()
            ->assertJsonPath('status', 'pending_payment')
            ->assertJsonPath('email', 'b••••@example.com')
            ->assertJsonPath('formats', ['mp4'])
            ->assertJsonMissingPath('ip')
            ->assertJsonMissingPath('error');

        $this->getJson('/api/v1/banners/orders/00000000-0000-4000-8000-000000000000')->assertNotFound();
        $this->getJson('/api/v1/banners/orders/not-a-uuid')->assertNotFound();
    }
}

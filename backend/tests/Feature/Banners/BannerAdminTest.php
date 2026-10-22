<?php

namespace Tests\Feature\Banners;

use App\Enums\BannerTemplateStatus;
use App\Jobs\ProcessBannerTemplate;
use App\Models\BannerFont;
use App\Models\BannerTemplate;
use App\Models\User;
use Database\Factories\BannerTemplateFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

class BannerAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('banners');
        Queue::fake();

        $token = JWTAuth::fromUser(User::factory()->admin()->create());
        $this->withHeader('Authorization', "Bearer {$token}");
    }

    private function woff2(string $name = 'font.woff2'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, 'wOF2' . str_repeat("\0", 200));
    }

    // ─── Fonts ─────────────────────────────────────────────────

    public function test_font_upload_stores_woff2_publicly(): void
    {
        $response = $this->post('/api/v1/admin/banner-fonts', [
            'name' => 'Unbounded', 'weight' => 700, 'style' => 'normal', 'file' => $this->woff2(),
        ], ['Accept' => 'application/json'])->assertCreated();

        $font = BannerFont::firstOrFail();
        Storage::disk('public')->assertExists($font->path);
        $this->assertSame("banners/fonts/{$font->uuid}.woff2", $font->path);
        $response->assertJsonPath('family', 'bf-' . $font->id)->assertJsonMissingPath('path');
    }

    public function test_font_upload_rejects_non_woff2(): void
    {
        $this->post('/api/v1/admin/banner-fonts', [
            'name' => 'Fake', 'weight' => 400, 'style' => 'normal',
            'file' => UploadedFile::fake()->createWithContent('font.woff2', '<svg onload=alert(1)>'),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('file');

        $this->assertSame(0, BannerFont::count());
    }

    public function test_font_used_by_template_cannot_be_deleted(): void
    {
        $font = BannerFont::factory()->create();
        $template = BannerTemplate::factory()->create(['config' => BannerTemplateFactory::sampleConfig($font->id)]);

        $this->deleteJson("/api/v1/admin/banner-fonts/{$font->id}")
            ->assertStatus(409)
            ->assertJsonPath('templates.0.id', $template->id);

        $unused = BannerFont::factory()->create();
        $this->deleteJson("/api/v1/admin/banner-fonts/{$unused->id}")->assertOk();
        $this->assertSoftDeleted($unused);
    }

    // ─── Templates ─────────────────────────────────────────────

    public function test_create_template_generates_slug_and_defaults(): void
    {
        $this->postJson('/api/v1/admin/banner-templates', ['name' => 'Neon Cards', 'price' => 15, 'is_active' => true])
            ->assertCreated()
            ->assertJsonPath('slug', 'neon-cards')
            ->assertJsonPath('is_active', false) // no video yet
            ->assertJsonPath('config.schemaVersion', 1)
            ->assertJsonPath('watermark.opacity', 20)
            ->assertJsonPath('outputs.mp4', true);

        $this->postJson('/api/v1/admin/banner-templates', ['name' => 'Neon Cards'])
            ->assertCreated()->assertJsonPath('slug', 'neon-cards-2');
    }

    public function test_update_validates_config(): void
    {
        $template = BannerTemplate::factory()->create();
        $font = BannerFont::factory()->create();

        $config = BannerTemplateFactory::sampleConfig($font->id);
        $this->putJson("/api/v1/admin/banner-templates/{$template->id}", ['config' => $config])
            ->assertOk()->assertJsonPath('config.zones.1.key', 'title');

        $config['zones'][1]['style']['color'] = 'javascript:alert(1)';
        $this->putJson("/api/v1/admin/banner-templates/{$template->id}", ['config' => $config])
            ->assertStatus(422)->assertJsonValidationErrors('config.zones.1.style.color');
    }

    public function test_cannot_publish_without_media_or_zones(): void
    {
        $noVideo = BannerTemplate::factory()->create();
        $this->putJson("/api/v1/admin/banner-templates/{$noVideo->id}", ['is_active' => true])
            ->assertStatus(422)->assertJsonValidationErrors('is_active');

        $ready = BannerTemplate::factory()->published()->create(['is_active' => false]);
        $this->putJson("/api/v1/admin/banner-templates/{$ready->id}", ['is_active' => true])
            ->assertOk()->assertJsonPath('is_active', true);
    }

    public function test_upload_source_queues_processing_on_banners_queue(): void
    {
        $template = BannerTemplate::factory()->create();

        $this->post("/api/v1/admin/banner-templates/{$template->id}/source", [
            'video' => UploadedFile::fake()->create('clip.mp4', 500, 'video/mp4'),
        ], ['Accept' => 'application/json'])->assertStatus(202)->assertJsonPath('processing_status', 'pending');

        $template->refresh();
        Storage::disk('banners')->assertExists($template->upload_path);
        Queue::assertPushed(ProcessBannerTemplate::class, function (ProcessBannerTemplate $job) use ($template) {
            return $job->templateId === $template->id
                && $job->uploadPath === $template->upload_path
                && $job->rev === 1
                && $job->connection === 'banners'
                && $job->queue === 'banners';
        });
    }

    public function test_upload_source_rejects_non_video(): void
    {
        $template = BannerTemplate::factory()->create();

        $this->post("/api/v1/admin/banner-templates/{$template->id}/source", [
            'video' => UploadedFile::fake()->create('clip.exe', 100, 'application/x-msdownload'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        Queue::assertNothingPushed();
    }

    public function test_watermark_change_rebuilds_preview(): void
    {
        $template = BannerTemplate::factory()->published()->create();

        $this->putJson("/api/v1/admin/banner-templates/{$template->id}", ['watermark' => ['text' => 'DEMO', 'opacity' => 30]])
            ->assertOk()->assertJsonPath('processing_status', 'pending');

        Queue::assertPushed(ProcessBannerTemplate::class, fn ($job) => $job->uploadPath === null);
    }

    public function test_delete_soft_deletes_and_frees_slug(): void
    {
        $template = BannerTemplate::factory()->published()->create(['slug' => 'neon']);

        $this->deleteJson("/api/v1/admin/banner-templates/{$template->id}")->assertOk();

        $this->assertSoftDeleted($template);
        $this->postJson('/api/v1/admin/banner-templates', ['name' => 'Neon', 'slug' => 'neon'])->assertCreated();
    }

    public function test_index_hides_file_paths(): void
    {
        BannerTemplate::factory()->published()->create();

        $this->getJson('/api/v1/admin/banner-templates')
            ->assertOk()
            ->assertJsonMissingPath('0.source_path')
            ->assertJsonMissingPath('0.preview_path')
            ->assertJsonPath('0.has_media', true)
            ->assertJsonPath('0.processing_status', BannerTemplateStatus::Ready->value);
    }
}

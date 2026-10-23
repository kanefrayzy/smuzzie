<?php

namespace Tests\Feature\Banners;

use App\Console\Commands\BannerFontsImportCommand;
use App\Models\BannerFont;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BannerFontsImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_names_weights_and_styles_come_from_folder_and_file_names(): void
    {
        $cases = [
            'Fira_Sans/FiraSans-SemiBoldItalic.woff2' => ['Fira Sans', 600, 'italic'],
            'Fira_Sans/FiraSans-ExtraLight.woff2' => ['Fira Sans', 200, 'normal'],
            'Lato/Lato-Italic.woff2' => ['Lato', 400, 'italic'],
            'Lato/Lato-Black.woff2' => ['Lato', 900, 'normal'],
            'PT_Sans/PTSans-Web-BoldItalic.woff2' => ['PT Sans', 700, 'italic'],
            'PT_Mono/PTM55FT.woff2' => ['PT Mono', 400, 'normal'],
        ];
        foreach ($cases as $path => [$name, $weight, $style]) {
            $this->assertSame(['name' => $name, 'weight' => $weight, 'style' => $style], BannerFontsImportCommand::parse("/x/{$path}"), $path);
        }
    }

    public function test_imports_once_and_skips_bad_files(): void
    {
        Storage::fake('public');
        $dir = sys_get_temp_dir() . '/bnfonts-' . uniqid();
        mkdir("{$dir}/Arvo", 0777, true);
        file_put_contents("{$dir}/Arvo/Arvo-Bold.woff2", 'wOF2' . str_repeat('x', 100));
        file_put_contents("{$dir}/Arvo/Arvo-Regular.woff2", 'wOF2' . str_repeat('x', 100));
        file_put_contents("{$dir}/Arvo/Fake-Italic.woff2", 'not a font');
        file_put_contents("{$dir}/Arvo/OFL.txt", 'license');

        $this->artisan('banners:import-fonts', ['dir' => $dir, '--dry-run' => true])->assertFailed();
        $this->assertSame(0, BannerFont::count());

        $this->artisan('banners:import-fonts', ['dir' => $dir])->assertFailed(); // one bad file
        $this->assertSame(2, BannerFont::count());
        $bold = BannerFont::where('weight', 700)->firstOrFail();
        $this->assertSame(['Arvo', 'normal'], [$bold->name, $bold->style]);
        Storage::disk('public')->assertExists($bold->path);
        $this->assertSame("banners/fonts/{$bold->uuid}.woff2", $bold->path);

        unlink("{$dir}/Arvo/Fake-Italic.woff2");
        $this->artisan('banners:import-fonts', ['dir' => $dir])->expectsOutputToContain('0 added, 2 already there')->assertSuccessful();
        $this->assertSame(2, BannerFont::count());

        array_map('unlink', glob("{$dir}/Arvo/*"));
        rmdir("{$dir}/Arvo");
        rmdir($dir);
    }
}

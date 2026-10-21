<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * Every route under /api/v1/admin must reject guests (401) and logged-in non-admins (403).
 * Walks the route table instead of listing endpoints by hand, so routes added later
 * (banner templates, fonts, orders) are covered automatically.
 */
class AdminRoutesAccessTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<int, array{string, string}> [method, uri] */
    private function adminRoutes(): array
    {
        $routes = [];
        /** @var RoutingRoute $route */
        foreach (Route::getRoutes() as $route) {
            if (!str_starts_with($route->uri(), 'api/v1/admin/')) {
                continue;
            }
            // Any value works for {params}: the auth layers must answer before model binding
            $uri = '/' . preg_replace('/\{[^}]+\}/', '1', $route->uri());
            foreach ($route->methods() as $method) {
                if (!in_array($method, ['HEAD', 'OPTIONS'], true)) {
                    $routes[] = [$method, $uri];
                }
            }
        }
        return $routes;
    }

    public function test_admin_route_table_is_not_empty(): void
    {
        $this->assertGreaterThan(20, count($this->adminRoutes()));
    }

    public function test_guests_get_401_on_every_admin_route(): void
    {
        foreach ($this->adminRoutes() as [$method, $uri]) {
            $this->json($method, $uri)->assertStatus(401, "{$method} {$uri} must require a token");
        }
    }

    public function test_non_admin_users_get_403_on_every_admin_route(): void
    {
        $user = User::factory()->create(); // role defaults to "user"
        $token = JWTAuth::fromUser($user);

        foreach ($this->adminRoutes() as [$method, $uri]) {
            $this->withHeader('Authorization', "Bearer {$token}")
                ->json($method, $uri)
                ->assertStatus(403, "{$method} {$uri} must require the admin role");
        }
    }

    public function test_admin_users_get_through(): void
    {
        $admin = User::factory()->admin()->create();
        $token = JWTAuth::fromUser($admin);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/admin/auth/me')
            ->assertOk()
            ->assertJsonPath('email', $admin->email);

        // Model binding still runs for admins after the role check moved ahead of it
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/admin/portfolio/999')
            ->assertNotFound();
    }
}

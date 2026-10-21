<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    /**
     * Public and admin routes share controllers. Only admin routes (which sit
     * behind auth:api + admin middleware) may see inactive records.
     */
    protected function isAdminRequest(Request $request): bool
    {
        return $request->is('api/v1/admin/*');
    }
}

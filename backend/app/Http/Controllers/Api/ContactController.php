<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ContactController extends Controller
{
    public function index()
    {
        $submissions = ContactSubmission::orderBy('created_at', 'desc')->paginate(20);
        return response()->json($submissions);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|max:255',
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:5000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();

        // Sanitize user input to prevent stored XSS
        $validated['name'] = strip_tags($validated['name']);
        $validated['email'] = strip_tags($validated['email']);
        $validated['subject'] = strip_tags($validated['subject']);
        $validated['message'] = strip_tags($validated['message']);

        $submission = ContactSubmission::create($validated);

        return response()->json([
            'message' => 'Your message has been sent successfully!',
            'submission' => $submission,
        ], 201);
    }

    public function show(ContactSubmission $contactSubmission)
    {
        if ($contactSubmission->status === 'new') {
            $contactSubmission->update(['status' => 'read']);
        }
        return response()->json($contactSubmission);
    }

    public function updateStatus(Request $request, ContactSubmission $contactSubmission)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:new,read,replied,archived',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $contactSubmission->update(['status' => $request->status]);

        return response()->json($contactSubmission);
    }

    public function destroy(ContactSubmission $contactSubmission)
    {
        $contactSubmission->delete();
        return response()->json(['message' => 'Submission deleted successfully']);
    }
}

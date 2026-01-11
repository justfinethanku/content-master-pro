import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ApiDocsPage() {
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Partner API Documentation</h1>
        <p className="mt-2 text-muted-foreground">
          Complete guide to using the Content Master Pro Partner API
        </p>
      </div>

      <div className="space-y-8">
        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Quick setup guide for the Partner API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">1. Get an API Key</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                After your invite is redeemed, go to{" "}
                <a href="/partner/keys" className="text-primary underline">
                  Partner &gt; API Keys
                </a>{" "}
                to create your first API key.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">2. Authentication</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Include your API key in the Authorization header as a Bearer token:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                <code>Authorization: Bearer pk_live_your_api_key_here</code>
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">3. Base URL</h3>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                <code>https://your-domain.com/api/v1</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Endpoint */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500">POST</Badge>
                <code className="text-foreground">/api/v1/search</code>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Search across your accessible namespaces using semantic similarity
              </p>

              <Tabs defaultValue="request" className="mt-4">
                <TabsList>
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="mt-2">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`{
  "query": "AI content creation workflows",
  "namespaces": ["jon", "nate"],  // optional
  "topK": 10                       // optional, default 10
}`}
                  </pre>
                </TabsContent>
                <TabsContent value="response" className="mt-2">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`{
  "results": [
    {
      "id": "post-123-chunk-0",
      "score": 0.92,
      "title": "Building AI Workflows",
      "content": "Preview of the matched content...",
      "source": "jon",
      "url": "https://...",
      "metadata": {
        "author": "Jonathan Edwards",
        "publishedAt": "2024-01-15"
      }
    }
  ],
  "query": "AI content creation workflows",
  "namespaces": ["jon", "nate"],
  "count": 10,
  "rateLimit": {
    "remaining": 59,
    "resetAt": "2024-01-10T23:00:00Z",
    "dailyRemaining": 4999,
    "dailyResetAt": "2024-01-11T00:00:00Z"
  }
}`}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>

            {/* Namespaces Endpoint */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500">GET</Badge>
                <code className="text-foreground">/api/v1/namespaces</code>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                List all namespaces you have access to
              </p>

              <Tabs defaultValue="response" className="mt-4">
                <TabsList>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="response" className="mt-2">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`{
  "namespaces": [
    {
      "slug": "jon",
      "display_name": "Jon",
      "description": "Jonathan Edwards' newsletter posts",
      "source_type": "newsletter",
      "can_read": true,
      "can_write": false
    }
  ]
}`}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rate limits are applied per partner account. Default limits:
            </p>
            <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">60 requests per minute</strong> -
                Sliding window
              </li>
              <li>
                <strong className="text-foreground">5,000 requests per day</strong> -
                Resets at midnight UTC
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              When rate limited, you&apos;ll receive a <code>429 Too Many Requests</code>{" "}
              response with a <code>Retry-After</code> header.
            </p>
            <h4 className="mt-4 font-semibold text-foreground">Response Headers</h4>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`X-RateLimit-Remaining: 58
X-RateLimit-Reset: 2024-01-10T23:01:00Z
X-RateLimit-Daily-Remaining: 4998
X-RateLimit-Daily-Reset: 2024-01-11T00:00:00Z`}
            </pre>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle>Error Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-4 rounded-lg border border-border p-3">
                <Badge variant="destructive">400</Badge>
                <div>
                  <p className="font-medium text-foreground">Bad Request</p>
                  <p className="text-sm text-muted-foreground">
                    Invalid request body or parameters
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-lg border border-border p-3">
                <Badge variant="destructive">401</Badge>
                <div>
                  <p className="font-medium text-foreground">Unauthorized</p>
                  <p className="text-sm text-muted-foreground">
                    Missing or invalid API key
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-lg border border-border p-3">
                <Badge variant="destructive">403</Badge>
                <div>
                  <p className="font-medium text-foreground">Forbidden</p>
                  <p className="text-sm text-muted-foreground">
                    No access to requested namespace
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-lg border border-border p-3">
                <Badge variant="secondary">429</Badge>
                <div>
                  <p className="font-medium text-foreground">Too Many Requests</p>
                  <p className="text-sm text-muted-foreground">
                    Rate limit exceeded
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-lg border border-border p-3">
                <Badge variant="destructive">500</Badge>
                <div>
                  <p className="font-medium text-foreground">Internal Server Error</p>
                  <p className="text-sm text-muted-foreground">
                    Something went wrong on our end
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Code Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>

              <TabsContent value="curl" className="mt-4">
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`curl -X POST https://your-domain.com/api/v1/search \\
  -H "Authorization: Bearer pk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "AI content creation",
    "topK": 10
  }'`}
                </pre>
              </TabsContent>

              <TabsContent value="javascript" className="mt-4">
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`const response = await fetch('https://your-domain.com/api/v1/search', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer pk_live_your_api_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'AI content creation',
    topK: 10,
  }),
});

const data = await response.json();
console.log(data.results);`}
                </pre>
              </TabsContent>

              <TabsContent value="python" className="mt-4">
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
{`import requests

response = requests.post(
    'https://your-domain.com/api/v1/search',
    headers={
        'Authorization': 'Bearer pk_live_your_api_key',
        'Content-Type': 'application/json',
    },
    json={
        'query': 'AI content creation',
        'topK': 10,
    }
)

data = response.json()
print(data['results'])`}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

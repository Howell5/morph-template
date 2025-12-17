import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";

/**
 * Posts page demonstrating:
 * - Type-safe API calls with Hono client
 * - React Query integration
 * - Protected routes (create post requires auth)
 */
export function PostsPage() {
  const { data: session } = useSession();

  // Type-safe API call - no manual typing needed!
  const { data, isLoading, error } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const response = await (api as any).api.posts.$get({
        query: { page: "1", limit: "10" },
      });
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading posts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-destructive">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold">Posts</h1>
        {session && (
          <Button onClick={() => alert("Create post form coming soon!")}>Create Post</Button>
        )}
      </div>

      {data?.posts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No posts yet. Create one to get started!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data?.posts.map((post: any) => (
            <Card key={post.id}>
              <CardHeader>
                <CardTitle>{post.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{post.content}</p>
                <div className="mt-4 text-sm text-muted-foreground">
                  By {post.user.name} • {new Date(post.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

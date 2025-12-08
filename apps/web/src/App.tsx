import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/query-client";
import { PostsPage } from "./pages/posts";
import { useSession } from "./lib/auth-client";
import { Button } from "./components/ui/button";
import { authClient } from "./lib/auth-client";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <PostsPage />
        </main>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

function Header() {
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
  };

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Morph Template</h1>
        </div>
        <div className="flex items-center gap-4">
          {isPending ? (
            <span className="text-sm text-muted-foreground">Loading...</span>
          ) : session ? (
            <>
              <span className="text-sm">Welcome, {session.user.name}</span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => alert("Sign in form coming soon!")}>
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default App;

import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Layout from "@/components/layout";
import { PlayerProvider } from "@/hooks/use-player";

import AlbumsPage from "@/pages/albums";
import AlbumDetail from "@/pages/album-detail";
import ArtistsPage from "@/pages/artists";
import ArtistDetail from "@/pages/artist-detail";
import GenresPage from "@/pages/genres";
import GenreDetail from "@/pages/genre-detail";
import BrowsePage from "@/pages/browse";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    }
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/albums" />} />
      <Route path="/albums" component={AlbumsPage} />
      <Route path="/albums/:id" component={AlbumDetail} />
      <Route path="/artists" component={ArtistsPage} />
      <Route path="/artists/:id" component={ArtistDetail} />
      <Route path="/genres" component={GenresPage} />
      <Route path="/genres/:name" component={GenreDetail} />
      <Route path="/browse" component={BrowsePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <PlayerProvider>
            <Layout>
              <Router />
            </Layout>
          </PlayerProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

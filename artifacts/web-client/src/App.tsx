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
import LikedPage from "@/pages/liked";
import PlaylistPage from "@/pages/playlist";
import LibraryPage from "@/pages/library";
import LibrariesPage from "@/pages/libraries";
import VideoListPage from "@/pages/video-list";
import VideoFolderPage from "@/pages/video-folder";
import VideoGenresPage from "@/pages/video-genres";

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

      {/* Standard music routes */}
      <Route path="/albums" component={AlbumsPage} />
      <Route path="/albums/:id" component={AlbumDetail} />
      <Route path="/artists" component={ArtistsPage} />
      <Route path="/artists/:id" component={ArtistDetail} />
      <Route path="/genres" component={GenresPage} />
      <Route path="/genres/:name" component={GenreDetail} />
      <Route path="/browse" component={BrowsePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/liked" component={LikedPage} />
      <Route path="/playlists/:id" component={PlaylistPage} />

      {/* Library list page — primary mobile entry point for libraries */}
      <Route path="/libraries" component={LibrariesPage} />

      {/* Library landing page */}
      <Route path="/library/:id" component={LibraryPage} />

      {/* Library-scoped music routes — each page self-detects library via useRoute */}
      <Route path="/library/:id/albums" component={AlbumsPage} />
      <Route path="/library/:id/artists" component={ArtistsPage} />
      <Route path="/library/:id/genres" component={GenresPage} />
      <Route path="/library/:id/browse" component={BrowsePage} />

      {/* Library-scoped video routes */}
      <Route path="/library/:id/videos" component={VideoListPage} />
      <Route path="/library/:id/video-genres" component={VideoGenresPage} />
      <Route path="/library/:id/video-folder" component={VideoFolderPage} />

      {/* Global video genre browse */}
      <Route path="/video-genres/:genre" component={VideoListPage} />

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

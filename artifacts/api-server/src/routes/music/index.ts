import { Router, type IRouter } from "express";
import librariesRouter from "./libraries";
import artistsRouter from "./artists";
import albumsRouter from "./albums";
import tracksRouter from "./tracks";
import genresRouter from "./genres";
import browseRouter from "./browse";
import searchRouter from "./search";
import playlistsRouter from "./playlists";

const router: IRouter = Router();

router.use(librariesRouter);
router.use(artistsRouter);
router.use(albumsRouter);
router.use(tracksRouter);
router.use(genresRouter);
router.use(browseRouter);
router.use(searchRouter);
router.use(playlistsRouter);

export default router;

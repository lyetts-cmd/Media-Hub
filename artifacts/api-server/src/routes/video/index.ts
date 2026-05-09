import { Router, type IRouter } from "express";
import videosRouter from "./videos";
import streamRouter from "./stream";
import subtitlesRouter from "./subtitles";
import genresRouter from "./genres";
import browseRouter from "./browse";

const router: IRouter = Router();

router.use(videosRouter);
router.use(streamRouter);
router.use(subtitlesRouter);
router.use(genresRouter);
router.use(browseRouter);

export default router;

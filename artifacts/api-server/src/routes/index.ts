import { Router, type IRouter } from "express";
import healthRouter from "./health";
import musicRouter from "./music/index";
import videoRouter from "./video/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/music", musicRouter);
router.use("/video", videoRouter);

export default router;

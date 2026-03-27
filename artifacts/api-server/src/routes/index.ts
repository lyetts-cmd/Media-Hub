import { Router, type IRouter } from "express";
import healthRouter from "./health";
import musicRouter from "./music/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/music", musicRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import feedbackRouter from "./feedback";
import taskflowRouter from "./taskflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(feedbackRouter);
router.use(taskflowRouter);

export default router;

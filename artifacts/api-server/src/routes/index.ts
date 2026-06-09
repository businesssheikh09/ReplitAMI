import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clientsRouter from "./clients";
import hotelsRouter from "./hotels";
import quotationsRouter from "./quotations";
import transportRouter from "./transport";
import visaRouter from "./visa";
import flightsRouter from "./flights";
import accountingRouter from "./accounting";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(clientsRouter);
router.use(hotelsRouter);
router.use(quotationsRouter);
router.use(transportRouter);
router.use(visaRouter);
router.use(flightsRouter);
router.use(accountingRouter);
router.use(dashboardRouter);

export default router;

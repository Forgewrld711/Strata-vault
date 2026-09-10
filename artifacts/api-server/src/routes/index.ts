import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import memoriesRouter from "./memories";
import connectionsRouter from "./connections";
import tagsRouter from "./tags";
import statsRouter from "./stats";
import mcpRouter from "./mcp";
import quizRouter from "./quiz";
import forumRouter from "./forum";
import journalRouter from "./journal";
import mailRouter from "./mail";
import agentsRouter from "./agents";
import oauthRouter from "./oauth";
import compostRouter from "./compost";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(memoriesRouter);
router.use(connectionsRouter);
router.use(tagsRouter);
router.use(statsRouter);
router.use(mcpRouter);
router.use(quizRouter);
router.use(forumRouter);
router.use(journalRouter);
router.use(mailRouter);
router.use(agentsRouter);
router.use(oauthRouter);
router.use(compostRouter);

export default router;

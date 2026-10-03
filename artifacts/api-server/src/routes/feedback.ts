import { Router, type IRouter } from "express";
import { SubmitFeedbackBody, SubmitFeedbackResponse } from "@workspace/api-zod";
import { db, taskflowFeedbackTable } from "@workspace/db";

const router: IRouter = Router();
const attemptsByAddress = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

router.post("/feedback", async (req, res): Promise<void> => {
  const body = SubmitFeedbackBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const now = Date.now();
  const addressKey = req.ip || "unknown";
  const recentAttempts = (attemptsByAddress.get(addressKey) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );
  if (recentAttempts.length >= MAX_PER_WINDOW) {
    res.status(429).json({ error: "Please try again later." });
    return;
  }
  recentAttempts.push(now);
  attemptsByAddress.set(addressKey, recentAttempts);

  await db.insert(taskflowFeedbackTable).values({ message: body.data.message });
  res.status(201).json(SubmitFeedbackResponse.parse({ received: true }));
});

export default router;
// api/index.js: the doorway Vercel uses to run our Express server online.
// Every /api/... request is sent here (see vercel.json) and handled by server/index.js.
import app from "../server/index.js";

export default app;

export default async function (req: any, res: any) {
  try {
    const { default: app } = await import('../src/backend/app');
    return app(req, res);
  } catch (error: any) {
    console.error("[Vercel Handler Error]:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Runtime initialization error",
        message: error?.message || String(error),
        stack: error?.stack || ""
      });
    }
  }
}
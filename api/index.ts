export default async function handler(req: any, res: any) {
  try {
    const { default: app } = await import("../src/backend/app");
    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel Startup] Error loading application:", err);
    res.status(500).json({
      error: "Vercel Startup / Import Error",
      message: err?.message || String(err),
      stack: err?.stack || "",
      cwd: process.cwd()
    });
  }
}

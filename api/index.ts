let app: any = null;
let loadError: any = null;

try {
  // Attempt to load the application module
  const appModule = await import('../src/backend/app');
  app = appModule.default;
} catch (e: any) {
  loadError = {
    name: e?.name || "Error",
    message: e?.message || String(e),
    stack: e?.stack || "",
    code: e?.code || ""
  };
}

export default function handler(req: any, res: any) {
  if (loadError) {
    console.error("[Loader Error]:", loadError);
    return res.status(500).json({
      error: "Vercel Module Load Failure",
      details: loadError
    });
  }

  try {
    return app(req, res);
  } catch (err: any) {
    console.error("[Route Error]:", err);
    return res.status(500).json({
      error: "Route handling error",
      message: err?.message || String(err),
      stack: err?.stack || ""
    });
  }
}

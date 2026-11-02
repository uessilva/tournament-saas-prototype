export function isDemoMode() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEMO_MODE !== "false"
  );
}

export function assertDemoMode() {
  if (!isDemoMode()) {
    throw new Error("Demo controls are disabled.");
  }
}

export type CameraEvent = {
  kind: "oven" | "court" | "night_over";
  payload: Record<string, unknown>;
};

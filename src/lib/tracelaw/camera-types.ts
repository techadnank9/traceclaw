export type CameraEvent = {
  kind: "oven" | "court" | "night_over" | "robot";
  payload: Record<string, unknown>;
};

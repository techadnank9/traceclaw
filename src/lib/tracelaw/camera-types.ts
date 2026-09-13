export type CameraEvent = {
  kind: "oven" | "court" | "night_over" | "robot" | "judge";
  payload: Record<string, unknown>;
};

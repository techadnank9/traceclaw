import { H, W, type Game } from "./bakery";

const C = {
  floor: "#e8d4b0",
  grout: "#d4bc96",
  wall: "#6b3e2e",
  cream: "#fffaf3",
  ink: "#1c1915",
  oven: "#3d2a18",
  fire: "#c45b4a",
  ok: "#3f6b4e",
  wood: "#8a5a3a",
  sticky: "#fff3bf",
};

export function draw(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.floor;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.grout;
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  ctx.fillStyle = C.wall;
  ctx.fillRect(0, 0, W, 56);
  ctx.fillStyle = C.cream;
  ctx.font = "600 22px Fraunces, serif";
  ctx.fillText("THE NIGHT OVEN  ·  2048 croissant muffins", 24, 36);

  desk(ctx, 50, 72, 90, 70, "BINDER");
  oven(ctx, g);
  tray(ctx);
  register(ctx);

  for (const c of g.customers) {
    if (c.alive) person(ctx, c.x, c.y, c.bob, c.facing, "#7a7268", "#c45b4a", null);
  }
  person(ctx, g.cass.x, g.cass.y, g.cass.bob, g.cass.facing, "#1c1915", "#3f6b4e", null);
  label(ctx, g.cass.x, g.cass.y - 34, "Cass");
  person(ctx, g.baker.x, g.baker.y, g.baker.bob, g.baker.facing, "#fffaf3", "#8a5a3a", g.baker.hold);
  label(ctx, g.baker.x, g.baker.y - 34, "Jules");
  person(ctx, g.player.x, g.player.y, g.player.bob, g.player.facing, "#fff3bf", "#c45b4a", g.player.hold);
  label(ctx, g.player.x, g.player.y - 36, "You");

  if (g.oven.has === "burnt" || g.phase === "court") {
    ctx.save();
    ctx.translate(720, 240);
    ctx.rotate(-0.2);
    ctx.strokeStyle = C.fire;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.fire;
    ctx.font = "700 28px Fraunces, serif";
    ctx.textAlign = "center";
    ctx.fillText("FAIL", 0, 10);
    ctx.restore();
  }

  if (g.popup.life > 0) {
    ctx.globalAlpha = Math.min(1, g.popup.life * 2);
    ctx.fillStyle = C.ok;
    ctx.font = "700 28px Fraunces, serif";
    ctx.textAlign = "center";
    ctx.fillText(g.popup.text, g.player.x, g.player.y - 58);
    ctx.globalAlpha = 1;
  }
}

function desk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string) {
  ctx.fillStyle = C.wood;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#1a4a6e";
  ctx.fillRect(x + 10, y + 12, w - 20, h - 28);
  ctx.fillStyle = C.sticky;
  ctx.fillRect(x + w - 28, y + 8, 22, 22);
  ctx.fillStyle = C.cream;
  ctx.font = "600 11px IBM Plex Sans, sans-serif";
  ctx.fillText(title, x + 10, y + h - 6);
}

function oven(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.fillStyle = C.oven;
  ctx.fillRect(670, 70, 100, 90);
  ctx.fillStyle = g.oven.has === "raw" ? "#e28a3a" : g.oven.has === "cooked" ? "#c45b4a" : g.oven.has === "burnt" ? "#2a1810" : "#1c1915";
  ctx.fillRect(688, 92, 64, 50);
  ctx.fillStyle = C.cream;
  ctx.font = "600 11px IBM Plex Sans, sans-serif";
  ctx.fillText("OVEN", 696, 155);
  if (g.oven.books === 2) {
    ctx.fillStyle = "#3f6b4e";
    ctx.fillRect(640, 100, 22, 28);
    ctx.fillStyle = C.wood;
    ctx.fillRect(628, 108, 22, 28);
  } else {
    ctx.fillStyle = C.wood;
    ctx.fillRect(640, 108, 22, 28);
  }
  if (g.oven.has === "raw") muffin(ctx, 720, 118, "raw");
  if (g.oven.has === "cooked") muffin(ctx, 720, 118, "cooked");
}

function tray(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#b9a48a";
  ctx.fillRect(820, 110, 90, 70);
  muffin(ctx, 844, 140, "raw");
  muffin(ctx, 876, 140, "raw");
  muffin(ctx, 860, 158, "raw");
  ctx.fillStyle = C.ink;
  ctx.font = "600 11px IBM Plex Sans, sans-serif";
  ctx.fillText("TRAY", 846, 188);
}

function register(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#c9b496";
  ctx.fillRect(150, 210, 120, 36);
  ctx.fillStyle = "#2b2118";
  ctx.fillRect(168, 168, 70, 44);
  ctx.fillStyle = C.ok;
  ctx.fillRect(178, 178, 50, 16);
  ctx.fillStyle = C.ink;
  ctx.font = "600 11px IBM Plex Sans, sans-serif";
  ctx.fillText("REGISTER", 168, 258);
}

function person(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bob: number,
  facing: number,
  hat: string,
  apron: string,
  hold: Game["player"]["hold"] | null,
) {
  const step = Math.sin(bob * 8) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#3c2814";
  ctx.fillRect(-7, 10 + step, 5, 10);
  ctx.fillRect(2, 10 - step, 5, 10);
  ctx.fillStyle = apron;
  ctx.beginPath();
  ctx.ellipse(0, 4, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2d2b0";
  ctx.beginPath();
  ctx.arc(0, -10, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hat;
  ctx.beginPath();
  ctx.ellipse(0, -16, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-8, -18, 16, 6);
  if (hold && hold !== "empty") {
    const hx = Math.cos(facing) * 14;
    const hy = Math.sin(facing) * 10;
    muffin(ctx, hx, hy, hold === "sticky" ? "raw" : hold);
  }
  ctx.restore();
}

function muffin(ctx: CanvasRenderingContext2D, x: number, y: number, kind: "raw" | "cooked" | "burnt") {
  ctx.fillStyle = kind === "cooked" ? "#c45b4a" : kind === "burnt" ? "#2a1810" : "#e8b4b8";
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = kind === "cooked" ? "#8a5a3a" : "#d9cfc0";
  ctx.fillRect(x - 6, y, 12, 7);
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.fillStyle = "rgba(28,25,21,0.72)";
  ctx.fillRect(x - 22, y - 10, 44, 14);
  ctx.fillStyle = C.cream;
  ctx.font = "600 10px IBM Plex Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}


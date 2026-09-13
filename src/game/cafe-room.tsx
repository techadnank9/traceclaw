/** Night café interior. Swap for bakery.glb when you drop it in public/models. */
import { useMemo } from "react";
import { CanvasTexture, DoubleSide, RepeatWrapping, SRGBColorSpace } from "three";

/** Procedural textures: no downloads, no CDN — drawn on a canvas at mount. */
function makeTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat: [number, number]) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, 512, 512);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function useCafeTextures() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const brick = makeTexture((ctx, w, h) => {
      ctx.fillStyle = "#5a3a2a";
      ctx.fillRect(0, 0, w, h);
      const bw = 64;
      const bh = 28;
      for (let y = 0, row = 0; y < h; y += bh, row++) {
        for (let x = -bw; x < w + bw; x += bw) {
          const ox = row % 2 ? bw / 2 : 0;
          const shade = 0.85 + Math.random() * 0.3;
          ctx.fillStyle = `rgb(${Math.round(150 * shade)}, ${Math.round(82 * shade)}, ${Math.round(58 * shade)})`;
          ctx.fillRect(x + ox + 2, y + 2, bw - 4, bh - 4);
        }
      }
    }, [8, 2]);
    const tile = makeTexture((ctx, w) => {
      const n = 8;
      const s = w / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? "#efe2c8" : "#cbb28c";
          ctx.fillRect(i * s, j * s, s, s);
          ctx.strokeStyle = "rgba(60,40,20,0.25)";
          ctx.strokeRect(i * s + 1, j * s + 1, s - 2, s - 2);
        }
    }, [6, 4]);
    const plank = makeTexture((ctx, w, h) => {
      ctx.fillStyle = "#9c7048";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 42) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.12})`;
        ctx.fillRect(0, y, w, 3);
        for (let k = 0; k < 40; k++) {
          ctx.fillStyle = `rgba(60,30,10,${0.05 + Math.random() * 0.08})`;
          ctx.fillRect(Math.random() * w, y + Math.random() * 40, 30 + Math.random() * 90, 1);
        }
      }
    }, [10, 8]);
    return { brick, tile, plank };
  }, []);
}

export function CafeRoom() {
  const tex = useCafeTextures();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 16]} />
        <meshStandardMaterial color="#d7b48a" map={tex?.plank ?? undefined} roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1]} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial color="#f2e6cf" map={tex?.tile ?? undefined} roughness={0.6} />
      </mesh>

      <Wall pos={[0, 1.8, -7.8]} size={[22, 3.6, 0.28]} />
      <Wall pos={[-10.9, 1.8, 0]} size={[0.28, 3.6, 16]} />
      <Wall pos={[10.9, 1.8, 0]} size={[0.28, 3.6, 16]} />

      {/* Exposed brick behind the counter, wainscot, chalk menu, pendant lamps */}
      <mesh position={[0, 1.8, -7.62]} receiveShadow>
        <planeGeometry args={[21.6, 3.5]} />
        <meshStandardMaterial color="#8a5238" map={tex?.brick ?? undefined} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.02, -7.55]}>
        <boxGeometry args={[21.6, 0.08, 0.06]} />
        <meshStandardMaterial color="#2b1d14" />
      </mesh>
      <mesh position={[0, 0.5, -7.58]} receiveShadow>
        <boxGeometry args={[21.6, 1.0, 0.04]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.7} />
      </mesh>
      <mesh position={[-1.0, 2.4, -7.5]}>
        <boxGeometry args={[2.6, 1.3, 0.05]} />
        <meshStandardMaterial color="#1b1a17" roughness={1} />
      </mesh>
      {[-5, 0, 5].map((x) => (
        <group key={x} position={[x, 3.2, -1.5]}>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.6]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0, -0.7, 0]}>
            <coneGeometry args={[0.32, 0.3, 24, 1, true]} />
            <meshStandardMaterial color="#1c1a17" side={DoubleSide} />
          </mesh>
          <mesh position={[0, -0.75, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={2.5} />
          </mesh>
          <pointLight position={[0, -0.8, 0]} intensity={4} distance={7} color="#ffcf8a" />
        </group>
      ))}

      <Window pos={[-4.5, 1.7, -7.64]} />
      <Window pos={[2.2, 1.7, -7.64]} />
      <Window pos={[-10.74, 1.7, -2]} rot />

      <mesh position={[-8.6, 0.55, 4.2]} castShadow>
        <boxGeometry args={[3.4, 1.1, 1.1]} />
        <meshStandardMaterial color="#2b2118" />
      </mesh>
      <mesh position={[-6.8, 1.15, 3.4]} castShadow>
        <boxGeometry args={[0.12, 0.9, 2.2]} />
        <meshStandardMaterial color="#1c1915" />
      </mesh>

      <mesh position={[6.5, 0.7, -5.6]} castShadow>
        <boxGeometry args={[3.2, 1.4, 1.4]} />
        <meshStandardMaterial color="#5c4030" />
      </mesh>
      <mesh position={[6.5, 1.35, -5.1]}>
        <boxGeometry args={[2.6, 0.04, 0.08]} />
        <meshStandardMaterial color="#cfe8ff" transparent opacity={0.25} />
      </mesh>

      <Table pos={[-3.2, 2.4]} />
      <Table pos={[0.4, 3.6]} />
      <Table pos={[4.2, 2.2]} />

      <mesh position={[-9.4, 1.7, -4.2]} castShadow>
        <boxGeometry args={[1.4, 1.1, 0.08]} />
        <meshStandardMaterial color="#1c1915" />
      </mesh>
      <mesh position={[-9.4, 1.7, -4.16]}>
        <boxGeometry args={[1.2, 0.9, 0.02]} />
        <meshStandardMaterial color="#3f6b4e" />
      </mesh>

      <mesh position={[9.8, 1.1, -3]} castShadow>
        <boxGeometry args={[0.9, 2.2, 2.4]} />
        <meshStandardMaterial color="#4a3424" />
      </mesh>

      <Lamp pos={[-3.2, 2.4]} />
      <Lamp pos={[0.4, 3.6]} />
      <Lamp pos={[6.4, -4.2]} />
      <Lamp pos={[-6, -3]} />
    </group>
  );
}

function Wall({ pos, size }: { pos: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#5a3d2b" />
    </mesh>
  );
}

function Window({ pos, rot }: { pos: [number, number, number]; rot?: boolean }) {
  return (
    <mesh position={pos} rotation={rot ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      <planeGeometry args={[2.2, 1.4]} />
      <meshStandardMaterial color="#8fa8c9" emissive="#24344a" emissiveIntensity={0.55} />
    </mesh>
  );
}

function Table({ pos }: { pos: [number, number] }) {
  const [x, z] = pos;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.06, 16]} />
        <meshStandardMaterial color="#c4a574" />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.72, 8]} />
        <meshStandardMaterial color="#2b2118" />
      </mesh>
      <mesh position={[0.7, 0.42, 0.15]} castShadow>
        <boxGeometry args={[0.38, 0.08, 0.38]} />
        <meshStandardMaterial color="#3d2a18" />
      </mesh>
    </group>
  );
}

function Lamp({ pos }: { pos: [number, number] }) {
  const [x, z] = pos;
  return (
    <group position={[x, 2.7, z]}>
      <mesh>
        <cylinderGeometry args={[0.12, 0.28, 0.18, 12]} />
        <meshStandardMaterial color="#fff3bf" emissive="#ffd978" emissiveIntensity={0.8} />
      </mesh>
      <pointLight color="#ffd9a0" intensity={3.2} distance={7} decay={2} />
    </group>
  );
}

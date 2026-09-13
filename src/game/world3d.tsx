import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Gltf, Html } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Quaternion, Vector3, type Object3D } from "three";
import rig from "../../public/models/g1-rig.json";
import type { Group, MeshStandardMaterial, PointLight } from "three";
import { CafeRoom } from "./cafe-room";
import { H, W, ST, tick, type Game, type Hold } from "./bakery";

export function toWorld(x: number, y: number): [number, number, number] {
  return [(x / W) * 16 - 8, 0, (y / H) * 12 - 6];
}

export function Loop({
  game,
  onUi,
}: {
  game: { current: Game };
  onUi: (g: Game) => void;
}) {
  const acc = useRef(0);
  useFrame((_, delta) => {
    tick(game.current, Math.min(0.1, delta));
    acc.current += delta;
    if (acc.current > 0.12) {
      acc.current = 0;
      onUi(game.current);
    }
  });
  return null;
}

export function BakeryScene({ game }: { game: { current: Game } }) {
  const bakery = useOptional("/models/bakery.glb");
  return (
    <>
      <color attach="background" args={["#2a2018"]} />
      <fog attach="fog" args={["#2a2018", 22, 40]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#fff6e0", "#6b4a30", 0.9]} />
      <directionalLight position={[6, 14, 8]} intensity={1.35} castShadow shadow-mapSize={[1024, 1024]} />
      <Rig game={game} />
      {bakery ? <Gltf src="/models/bakery.glb" /> : <CafeRoom />}
      <Oven game={game} />
      <Station pos={toWorld(ST.binder.x, ST.binder.y)} color="#1a4a6e" label="Binder" h={0.75} />
      <Station pos={toWorld(ST.register.x, ST.register.y)} color="#2b2118" label="Register" h={0.95} />
      <Station pos={toWorld(ST.tray.x, ST.tray.y)} color="#b9a48a" label="Tray" h={0.4} />
      <Robot who="you" pick={() => game.current.player} accent="#c45b4a" />
      <Robot who="jules" pick={() => game.current.baker} accent="#e8c36a" />
      <Robot who="cass" pick={() => game.current.cass} accent="#3f6b4e" />
      <Robot who="cust" pick={() => game.current.customers[0]} accent="#7a7268" />
      <Robot who="cust" pick={() => game.current.customers[1]} accent="#9a9186" />
      <Robot who="cust" pick={() => game.current.customers[2]} accent="#8a5a3a" />
      <ExtraBook game={game} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={22} blur={2.6} />
    </>
  );
}

function Rig({ game }: { game: { current: Game } }) {
  const { camera } = useThree();
  useFrame(() => {
    const [x, , z] = toWorld(game.current.player.x, game.current.player.y);
    camera.position.x += (x * 0.2 - camera.position.x) * 0.08;
    camera.position.y += (9.2 - camera.position.y) * 0.08;
    camera.position.z += (z * 0.2 + 11.5 - camera.position.z) * 0.08;
    camera.lookAt(x * 0.35, 0.2, z * 0.35);
  });
  return null;
}

function Oven({ game }: { game: { current: Game } }) {
  const door = useRef<MeshStandardMaterial>(null);
  const light = useRef<PointLight>(null);
  const fail = useRef<Group>(null);
  const muffin = useRef<Group>(null);
  useFrame(() => {
    const o = game.current.oven;
    const hot = o.has === "raw";
    const dead = o.has === "burnt" || game.current.phase === "court";
    const color = dead ? "#2a1810" : hot ? "#e28a3a" : o.has === "cooked" ? "#c45b4a" : "#3d2a18";
    if (door.current) {
      door.current.color.set(color);
      door.current.emissive.set(hot ? "#c45b4a" : "#000000");
      door.current.emissiveIntensity = hot ? 1.6 : 0;
    }
    if (light.current) light.current.intensity = hot ? 12 : dead ? 2 : 0.4;
    if (fail.current) fail.current.visible = dead;
    if (muffin.current) muffin.current.visible = o.has === "raw" || o.has === "cooked" || o.has === "burnt";
  });
  const [x, , z] = toWorld(ST.oven.x, ST.oven.y);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[1.5, 1.4, 1.1]} />
        <meshStandardMaterial color="#2a1c14" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.72, 0.52]}>
        <boxGeometry args={[0.85, 0.7, 0.08]} />
        <meshStandardMaterial ref={door} color="#3d2a18" />
      </mesh>
      <pointLight ref={light} color="#ff7a3c" intensity={0.4} distance={8} position={[0, 0.8, 0.4]} />
      <group ref={muffin} position={[0, 1.4, 0]} visible={false}>
        <MuffinMesh kind="cooked" y={0} z={0} />
      </group>
      <group ref={fail} visible={false}>
        <Html center position={[0, 1.9, 0]}>
          <span className="rounded-full border-4 border-danger px-3 py-1 font-display text-xl text-danger">FAIL</span>
        </Html>
      </group>
    </group>
  );
}

function ExtraBook({ game }: { game: { current: Game } }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = game.current.oven.books === 2;
  });
  const pos = toWorld(ST.oven.x, ST.oven.y);
  return (
    <group ref={ref} position={[pos[0] + 0.7, 0.7, pos[2] + 0.2]} visible={false}>
      <Book />
    </group>
  );
}

function Station({
  pos,
  color,
  label,
  h,
}: {
  pos: [number, number, number];
  color: string;
  label: string;
  h: number;
}) {
  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[1.15, h, 0.85]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html center position={[0, h + 0.28, 0]}>
        <span className="rounded-sm bg-fg/80 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-paper">{label}</span>
      </Html>
    </group>
  );
}

function Robot({
  who,
  pick,
  accent,
}: {
  who: "you" | "jules" | "cass" | "cust";
  pick: () =>
    | { x: number; y: number; facing: number; bob: number; hold?: Hold; alive?: boolean }
    | undefined;
  accent: string;
}) {
  const ref = useRef<Group>(null);
  const last = useRef<{ x: number; z: number; amp: number }>({ x: 0, z: 0, amp: 0 });
  const motion = useRef(false);
  // Unitree G1 glTFs (scripts/g1/export_g1.py) are opt-in via ?g1=1 until the
  // embedded-WebGL path is proven; the lit placeholder bodies are the default.
  const url = wantG1() ? `/models/${who}.glb` : "";
  const glb = useOptional(url);
  useFrame(() => {
    const b = pick();
    if (!ref.current) return;
    if (!b || b.alive === false) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const [x, , z] = toWorld(b.x, b.y);
    // No hop: the G1 glides. (Placeholder bodies bob a little while walking.)
    const moved = Math.hypot(x - last.current.x, z - last.current.z) > 0.002;
    motion.current = moved;
    last.current.amp += ((moved && !glb ? 0.05 : 0) - last.current.amp) * 0.2;
    last.current.x = x;
    last.current.z = z;
    ref.current.position.set(x, last.current.amp * Math.abs(Math.sin(b.bob * 8)), z);
    ref.current.rotation.y = -b.facing + Math.PI / 2;
  });
  const label = who === "you" ? "You" : who === "jules" ? "Jules" : who === "cass" ? "Cass" : "";
  return (
    <group ref={ref}>
      {glb ? <G1Body url={url} motion={motion} drive={who === "jules"} /> : <RobotBody accent={accent} intern={who === "jules"} />}
      <HandMuffin pick={pick} />
      {label ? (
        <Html center position={[0, 1.7, 0]} zIndexRange={[5, 0]}>
          <span className="rounded-sm bg-fg/80 px-1.5 text-[10px] text-paper">{label}</span>
        </Html>
      ) : null}
    </group>
  );
}

function RobotBody({ accent, intern }: { accent: string; intern?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.18, 12]} />
        <meshStandardMaterial color="#2a2420" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[0.42, 0.62, 0.32]} />
        <meshStandardMaterial color="#cfc6ba" metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.92, 0.17]}>
        <boxGeometry args={[0.28, 0.16, 0.04]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[0, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.2, 14, 14]} />
        <meshStandardMaterial color="#d9d2c8" metalness={0.5} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.34, 0.16]}>
        <boxGeometry args={[0.28, 0.08, 0.04]} />
        <meshStandardMaterial color="#7ec8e3" emissive="#5ad0ff" emissiveIntensity={0.9} />
      </mesh>
      {intern ? (
        <mesh position={[0, 1.58, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 6]} />
          <meshStandardMaterial color="#c45b4a" />
        </mesh>
      ) : null}
      <mesh position={[-0.28, 0.8, 0]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#a8a198" />
      </mesh>
      <mesh position={[0.28, 0.8, 0]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial color="#a8a198" />
      </mesh>
    </group>
  );
}

function HandMuffin({ pick }: { pick: () => { hold?: Hold } | undefined }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const hold = pick()?.hold;
    if (ref.current) ref.current.visible = Boolean(hold && hold !== "empty");
  });
  return (
    <group ref={ref} visible={false}>
      <MuffinMesh kind="cooked" y={0.75} z={0.32} />
    </group>
  );
}

function MuffinMesh({ kind, y = 0, z = 0 }: { kind: "raw" | "cooked" | "burnt"; y?: number; z?: number }) {
  const glb = useOptional("/models/muffin.glb");
  const color = kind === "cooked" ? "#c45b4a" : kind === "burnt" ? "#2a1810" : "#e8b4b8";
  if (glb) return <Gltf src="/models/muffin.glb" position={[0.22, y, z]} />;
  return (
    <group position={[0.22, y, z]}>
      <mesh castShadow>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.08, 0.07, 0.08, 10]} />
        <meshStandardMaterial color={kind === "cooked" ? "#8a5a3a" : "#d9cfc0"} />
      </mesh>
    </group>
  );
}

function Book() {
  const glb = useOptional("/models/book.glb");
  if (glb) return <Gltf src="/models/book.glb" />;
  return (
    <mesh castShadow rotation={[0, 0.4, 0]}>
      <boxGeometry args={[0.22, 0.28, 0.06]} />
      <meshStandardMaterial color="#3f6b4e" />
    </mesh>
  );
}

/** Module-level cache: one parse per URL, shared by every robot that uses it. */
const g1Cache = new Map<string, Promise<Object3D>>();
function loadG1(url: string): Promise<Object3D> {
  let p = g1Cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then(
        (buf) =>
          new Promise<Object3D>((res, rej) => new GLTFLoader().parse(buf, "/models/", (g) => res(g.scene), rej)),
      );
    g1Cache.set(url, p);
  }
  return p;
}

/**
 * Unitree G1 body without Suspense: drei's <Gltf> suspends the whole scene and,
 * with several robots, remount-storms until WebGL loses its context.
 */
type Leg = { hip: number[]; knee: number[]; thigh: number[]; shank: number[] };
const LEGS: Leg[] = [rig.left as Leg, rig.right as Leg];
const X_AXIS = new Vector3(1, 0, 0);

/** Rotate a rest-pose node (vertices baked in world frame) about a pivot. */
function aboutPivot(pivot: Vector3, q: Quaternion, prevPos: Vector3, prevQ: Quaternion): { p: Vector3; q: Quaternion } {
  // node' = R_pivot(q) ∘ prev  →  pos = q·(prevPos − pivot) + pivot, rot = q·prevQ
  return { p: prevPos.clone().sub(pivot).applyQuaternion(q).add(pivot), q: q.clone().multiply(prevQ) };
}

function G1Body({ url, motion, drive }: { url: string; motion: { current: boolean }; drive: boolean }) {
  const [obj, setObj] = useState<Object3D | null>(null);
  const bodies = useRef<Map<number, Object3D[]>>(new Map());
  const phase = useRef(0);
  const amp = useRef(0);

  // Procedural gait on the per-body glTF: hips swing about the hip pivot,
  // shanks flex about the knee pivot, alternating legs while the body moves.
  useFrame((_, dt) => {
    if (!drive || bodies.current.size === 0) return;
    const moving = motion.current;
    amp.current += ((moving ? 1 : 0) - amp.current) * Math.min(1, dt * 8);
    if (moving) phase.current += dt * 9;
    const a = amp.current;
    LEGS.forEach((leg, i) => {
      const ph = phase.current + (i === 0 ? 0 : Math.PI);
      const hipAngle = 0.55 * a * Math.sin(ph);
      const kneeAngle = -0.9 * a * Math.max(0, Math.sin(ph + 0.6));
      const hip = new Vector3(leg.hip[0], leg.hip[1], leg.hip[2]);
      const knee = new Vector3(leg.knee[0], leg.knee[1], leg.knee[2]);
      const qHip = new Quaternion().setFromAxisAngle(X_AXIS, hipAngle);
      const qKnee = new Quaternion().setFromAxisAngle(X_AXIS, kneeAngle);
      const shank = new Set(leg.shank);
      for (const b of leg.thigh) {
        let t = { p: new Vector3(0, 0, 0), q: new Quaternion() };
        if (shank.has(b)) t = aboutPivot(knee, qKnee, t.p, t.q);
        t = aboutPivot(hip, qHip, t.p, t.q);
        for (const n of bodies.current.get(b) ?? []) {
          n.position.copy(t.p);
          n.quaternion.copy(t.q);
        }
      }
    });
  });
  useEffect(() => {
    let live = true;
    loadG1(url)
      .then((scene) => {
        if (!live) return;
        const clone = scene.clone(true);
        const map = new Map<number, Object3D[]>();
        clone.traverse((o) => {
          if ((o as { isMesh?: boolean }).isMesh) {
            o.castShadow = true;
            o.receiveShadow = false;
          }
          const m = /^body(\d+)_/.exec(o.name);
          if (m) {
            const b = Number(m[1]);
            map.set(b, [...(map.get(b) ?? []), o]);
          }
        });
        bodies.current = map;
        setObj(clone);
      })
      .catch(() => {
        if (live) setObj(null);
      });
    return () => {
      live = false;
    };
  }, [url]);
  return obj ? <primitive object={obj} /> : null;
}

function wantG1(): boolean {
  if (typeof window === "undefined") return false;
  // G1 is the default; ?g1=0 falls back to the placeholder bodies.
  return new URLSearchParams(window.location.search).get("g1") !== "0";
}

function useOptional(url: string) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url, { method: "HEAD" })
      .then((r) => {
        if (live) setOk(r.ok);
      })
      .catch(() => {
        if (live) setOk(false);
      });
    return () => {
      live = false;
    };
  }, [url]);
  return ok;
}

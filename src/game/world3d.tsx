import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Gltf, Html } from "@react-three/drei";
import type { Group, MeshStandardMaterial, PointLight } from "three";
import { CafeRoom } from "./cafe-room";
import { H, W, tick, type Game, type Hold } from "./bakery";

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
      <color attach="background" args={["#0d0b09"]} />
      <fog attach="fog" args={["#0d0b09", 12, 28]} />
      <hemisphereLight args={["#fff3bf", "#1a1008", 0.35]} />
      <directionalLight position={[4, 8, 3]} intensity={0.45} castShadow shadow-mapSize={[1024, 1024]} />
      <Rig game={game} />
      {bakery ? <Gltf src="/models/bakery.glb" /> : <CafeRoom />}
      <Oven game={game} />
      <Station pos={toWorld(90, 110)} color="#1a4a6e" label="Binder" h={0.75} />
      <Station pos={toWorld(200, 210)} color="#2b2118" label="Register" h={0.95} />
      <Station pos={toWorld(860, 150)} color="#b9a48a" label="Tray" h={0.4} />
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
    camera.position.x += (x + 1.2 - camera.position.x) * 0.07;
    camera.position.y += (4.8 - camera.position.y) * 0.07;
    camera.position.z += (z + 6.4 - camera.position.z) * 0.07;
    camera.lookAt(x, 0.9, z - 0.4);
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
  const [x, , z] = toWorld(720, 130);
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
  const pos = toWorld(720, 130);
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
  const url = who === "cust" ? "" : `/models/${who}.glb`;
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
    ref.current.position.set(x, 0.05 * Math.abs(Math.sin(b.bob * 8)), z);
    ref.current.rotation.y = -b.facing + Math.PI / 2;
  });
  const label = who === "you" ? "You" : who === "jules" ? "Jules" : who === "cass" ? "Cass" : "";
  return (
    <group ref={ref}>
      {glb ? <Gltf src={url} /> : <RobotBody accent={accent} intern={who === "jules"} />}
      <HandMuffin pick={pick} />
      {label ? (
        <Html center position={[0, 1.7, 0]}>
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

/** Night café interior. Swap for bakery.glb when you drop it in public/models. */

export function CafeRoom() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[22, 16]} />
        <meshStandardMaterial color="#3a2a1c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1]} receiveShadow>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#c4a574" />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[22, 0.12, 16]} />
        <meshStandardMaterial color="#1a1410" />
      </mesh>

      <Wall pos={[0, 1.6, -7.8]} size={[22, 3.2, 0.28]} />
      <Wall pos={[-10.9, 1.6, 0]} size={[0.28, 3.2, 16]} />
      <Wall pos={[10.9, 1.6, 0]} size={[0.28, 3.2, 16]} />
      <Wall pos={[4, 1.6, 7.8]} size={[14, 3.2, 0.28]} />

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

"""Bake the Unitree G1 (MuJoCo Menagerie) into game-ready glTF.

MJCF + STL → forward kinematics at the "stand" keyframe → one mesh per visual
geom, transformed to world → Z-up→Y-up, feet at origin, facing +Z → decimated
→ public/models/{you,jules,cass}.glb with a per-character tint.
"""
from __future__ import annotations

import sys
from pathlib import Path

import mujoco
import numpy as np
import trimesh

src = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
target_faces = int(sys.argv[3]) if len(sys.argv) > 3 else 40000

model = mujoco.MjModel.from_xml_path(str(src / "g1.xml"))
data = mujoco.MjData(model)
key = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_KEY, "stand")
if key >= 0:
    mujoco.mj_resetDataKeyframe(model, data, key)
mujoco.mj_forward(model, data)

# MuJoCo Z-up, +X forward  →  glTF Y-up, +Z forward.
z_to_y = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=float)
face_z = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]], dtype=float)  # Ry(-90°): +X → +Z
R = face_z @ z_to_y

parts = []  # (verts in BODY frame, faces, rgba, body_id)
for g in range(model.ngeom):
    if model.geom_type[g] != mujoco.mjtGeom.mjGEOM_MESH:
        continue
    if model.geom_group[g] == 3:  # menagerie collision group
        continue
    rgba = model.geom_rgba[g].copy()
    if rgba[3] <= 0.05:
        continue
    m = model.geom_dataid[g]
    va, vn = model.mesh_vertadr[m], model.mesh_vertnum[m]
    fa, fn = model.mesh_faceadr[m], model.mesh_facenum[m]
    verts = model.mesh_vert[va : va + vn].astype(float)
    faces = model.mesh_face[fa : fa + fn].astype(np.int64)
    q = np.zeros(9)
    mujoco.mju_quat2Mat(q, model.geom_quat[g])
    local = verts @ q.reshape(3, 3).T + model.geom_pos[g]
    parts.append((local, faces, rgba, int(model.geom_bodyid[g])))

def body_T(b: int) -> np.ndarray:
    """Body world pose at the keyframe, in glTF (Y-up, +Z facing) coordinates."""
    q = np.zeros(9)
    mujoco.mju_quat2Mat(q, data.xquat[b])
    T = np.eye(4)
    T[:3, :3] = R @ q.reshape(3, 3)
    T[:3, 3] = R @ data.xpos[b]
    return T

world_pts = np.concatenate([(p[0] @ body_T(p[3])[:3, :3].T + body_T(p[3])[:3, 3]) for p in parts])
floor = world_pts[:, 1].min()
verts_all = world_pts


def build(tint: np.ndarray, strength: float) -> trimesh.Scene:
    scene = trimesh.Scene()
    total = sum(len(p[1]) for p in parts)
    for i, (v, f, rgba, b) in enumerate(parts):
        mesh = trimesh.Trimesh(vertices=v, faces=f, process=True)
        share = max(64, int(target_faces * len(f) / total))
        if len(mesh.faces) > share:
            try:
                mesh = mesh.simplify_quadric_decimation(face_count=share)
            except Exception:
                pass
        color = rgba[:3] * (1 - strength) + tint * strength
        mesh.fix_normals()
        mat = trimesh.visual.material.PBRMaterial(
            name=f"m{i}",
            baseColorFactor=np.append(color, 1.0).astype(float),
            metallicFactor=0.35,
            roughnessFactor=0.55,
            doubleSided=False,
        )
        mesh.visual = trimesh.visual.TextureVisuals(material=mat)
        T = body_T(b)
        T[1, 3] -= floor
        # Node name carries the MuJoCo body id so the game can drive it from a live sim.
        scene.add_geometry(mesh, node_name=f"body{b}_{i}", geom_name=f"g{i}", transform=T)
    return scene

variants = {
    "you": (np.array([0.45, 0.62, 0.85]), 0.35),
    "jules": (np.array([0.95, 0.45, 0.25]), 0.45),
    "cass": (np.array([0.35, 0.75, 0.55]), 0.35),
    "cust": (np.array([0.55, 0.52, 0.48]), 0.3),
}
out_dir.mkdir(parents=True, exist_ok=True)
for name, (tint, strength) in variants.items():
    scene = build(tint, strength)
    path = out_dir / f"{name}.glb"
    scene.export(str(path))
    faces = sum(len(g.faces) for g in scene.geometry.values())
    h = verts_all[:, 1].max() - floor
    print(f"{path.name}: {path.stat().st_size/1e6:.1f} MB, {faces} faces, height {h:.2f} m, parts {len(parts)}")

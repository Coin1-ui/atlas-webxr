import * as THREE from "./vendor/three.module.js";

/** Lightweight per-slide WebGL backgrounds — one renderer, swapped scenes. */
export class DeckWebGL {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.clock = new THREE.Clock();
    this.mode = "none";
    this.scenes = {};
    this.raf = 0;
    this.resize = this.resize.bind(this);
    window.addEventListener("resize", this.resize);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    for (const s of Object.values(this.scenes)) {
      if (s.camera?.isPerspectiveCamera) {
        s.camera.aspect = w / h;
        s.camera.updateProjectionMatrix();
      }
    }
  }

  /** @param {string} mode */
  setMode(mode) {
    this.mode = mode;
    if (mode === "none") {
      cancelAnimationFrame(this.raf);
      this.renderer.clear();
      return;
    }
    if (!this.scenes[mode]) this.scenes[mode] = this.buildScene(mode);
    if (!this.raf) this.tick();
  }

  buildScene(mode) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.8, 4.5);
    camera.lookAt(0, 0, 0);
    const objects = [];

    if (mode === "floor-grid") {
      const grid = new THREE.GridHelper(12, 24, 0x2dd4bf, 0x0f1c34);
      grid.position.y = -0.01;
      scene.add(grid);

      const geo = new THREE.BoxGeometry(0.9, 0.55, 0.9);
      const edges = new THREE.EdgesGeometry(geo);
      const box = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.85 })
      );
      box.position.set(0.6, 0.28, 0);
      scene.add(box);
      objects.push({ mesh: box, spin: true, float: true });

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.62, 48),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      scene.add(ring);
      objects.push({ mesh: ring, pulse: true });

      scene.fog = new THREE.FogExp2(0x050a14, 0.08);
    }

    if (mode === "orbit-cube") {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x2dd4bf,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });
      const cube = new THREE.Mesh(geo, mat);
      scene.add(cube);
      objects.push({ mesh: cube, spin: true });

      const pts = new Float32Array(120 * 3);
      for (let i = 0; i < pts.length; i += 3) {
        pts[i] = (Math.random() - 0.5) * 8;
        pts[i + 1] = (Math.random() - 0.5) * 4;
        pts[i + 2] = (Math.random() - 0.5) * 6;
      }
      const particles = new THREE.Points(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pts, 3)),
        new THREE.PointsMaterial({ color: 0x2dd4bf, size: 0.04, transparent: true, opacity: 0.35 })
      );
      scene.add(particles);
      objects.push({ mesh: particles, drift: true });
    }

    if (mode === "shield-grid") {
      const grid = new THREE.GridHelper(10, 20, 0x334155, 0x0f1c34);
      scene.add(grid);
      const shield = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.7, 1),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, wireframe: true, transparent: true, opacity: 0.4 })
      );
      shield.position.y = 0.9;
      scene.add(shield);
      objects.push({ mesh: shield, spin: true, slow: true });
    }

    if (mode === "particles") {
      const count = 200;
      const pts = new Float32Array(count * 3);
      const vels = [];
      for (let i = 0; i < count; i++) {
        pts[i * 3] = (Math.random() - 0.5) * 10;
        pts[i * 3 + 1] = Math.random() * 3 - 1;
        pts[i * 3 + 2] = (Math.random() - 0.5) * 6;
        vels.push({
          x: (Math.random() - 0.5) * 0.008,
          y: Math.random() * 0.012 + 0.004,
          z: (Math.random() - 0.5) * 0.008,
        });
      }
      const geom = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xfbbf24,
        size: 0.06,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(geom, mat);
      scene.add(particles);
      objects.push({ mesh: particles, burst: true, vels, geom });
    }

    return { scene, camera, objects };
  }

  tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const t = this.clock.getElapsedTime();
    const pack = this.scenes[this.mode];
    if (!pack) return;

    for (const o of pack.objects) {
      if (o.spin) {
        o.mesh.rotation.y = t * (o.slow ? 0.25 : 0.6);
        if (o.float) o.mesh.position.y = 0.28 + Math.sin(t * 1.2) * 0.06;
      }
      if (o.pulse) {
        const s = 1 + Math.sin(t * 2) * 0.08;
        o.mesh.scale.set(s, s, s);
      }
      if (o.drift) o.mesh.rotation.y = t * 0.08;
      if (o.burst && o.vels && o.geom) {
        const pos = o.geom.attributes.position.array;
        for (let i = 0; i < o.vels.length; i++) {
          pos[i * 3] += o.vels[i].x;
          pos[i * 3 + 1] += o.vels[i].y;
          pos[i * 3 + 2] += o.vels[i].z;
          if (pos[i * 3 + 1] > 3) pos[i * 3 + 1] = -1;
        }
        o.geom.attributes.position.needsUpdate = true;
      }
    }

    this.renderer.render(pack.scene, pack.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }
}

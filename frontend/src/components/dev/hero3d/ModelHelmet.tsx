'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { runStage, STAGE_MASK } from './stage';

export const HELMET_MODEL = '/images/dev/3d/helmet-tripo.glb';
const BG = '#030504';
// Rest pose: three-quarter view, face turned toward the hero text
const YAW = -1.3;

/**
 * Makes only the green circuit traces and eyes glow (the texture's bright,
 * green-dominant pixels) and runs a wave of light up the helmet now and then.
 */
function patchGlow(mat: THREE.MeshStandardMaterial, uniforms: { uSweep: { value: number } }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSweep = uniforms.uSweep;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY;\nuniform float uSweep;')
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
        #ifdef USE_EMISSIVEMAP
          vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
          float greenness = emissiveColor.g - max( emissiveColor.r, emissiveColor.b );
          float traces = smoothstep( 0.1, 0.4, greenness ) * smoothstep( 0.2, 0.65, emissiveColor.g );
          float wave = smoothstep( 0.09, 0.0, abs( vLocalY - uSweep ) );
          totalEmissiveRadiance *= emissiveColor.rgb * traces * ( 0.55 + wave * 2.2 );
        #endif
        `,
      );
  };
  mat.customProgramCacheKey = () => 'helmet-glow';
}

/**
 * The helmet as a textured 3D model (generated from the hero render with Tripo).
 * Turns toward the cursor; drag to spin it. `onReady` fires after the first frame.
 */
export default function ModelHelmet({ src = HELMET_MODEL, onReady }: { src?: string; onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return runStage(
      el,
      async ({ renderer, scene, camera, pointer, canvas }) => {
        canvas.style.cursor = 'grab';
        renderer.toneMappingExposure = 1.0;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = env;
        scene.environmentIntensity = 0.28;

        // Soft key from the front-right, green rim from behind-left that follows the cursor
        const key = new THREE.DirectionalLight('#ffffff', 0.7);
        key.position.set(2, 2, 3);
        // Directional, so it only edges the silhouette instead of leaving a hot spot
        const rim = new THREE.DirectionalLight('#34f596', 1.0);
        rim.position.set(-2.5, 1.5, -3);
        scene.add(key, rim);

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.loadAsync(src);
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(box.getCenter(new THREE.Vector3()));
        const holder = new THREE.Group();
        holder.add(model);
        holder.scale.setScalar(2.4 / size.y);

        const glow = { uSweep: { value: -1 } };
        const aniso = renderer.capabilities.getMaxAnisotropy();
        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap].forEach((t) => t && (t.anisotropy = aniso));
          // Fine normal detail glitters when it moves: keep it, but softer
          mat.normalScale.set(0.55, 0.55);
          mat.roughness = 1;
          mat.metalness = 0.85;
          if (mat.map) {
            mat.emissiveMap = mat.map;
            mat.emissive = new THREE.Color('#ffffff');
            mat.emissiveIntensity = 1.6;
            patchGlow(mat, glow);
          }
        });

        const pivot = new THREE.Group();
        pivot.add(holder);
        scene.add(pivot);

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.3, 0.85));
        composer.addPass(new OutputPass());

        let spin = 0;
        let spinVel = 0;
        let intro = 0;
        let announced = false;
        const onUp = () => (canvas.style.cursor = 'grab');
        const onDown = () => (canvas.style.cursor = 'grabbing');
        window.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointerdown', onDown);

        return {
          frame(t, dt) {
            intro = Math.min(1, intro + dt / 1.8);
            const e = 1 - Math.pow(1 - intro, 3);
            if (pointer.dragging) spinVel = pointer.dragDX * 0.008;
            else {
              spinVel *= Math.pow(0.04, dt);
              spin *= Math.pow(0.35, dt); // drift back to face the viewer
            }
            spin += spinVel;
            // Scrolling turns the helmet to watch the page go by
            const scroll = Math.min(1.2, pointer.scroll);
            pivot.rotation.y = YAW + spin + pointer.look.x * 0.5 + scroll * 0.9 + (1 - e) * 1.4 + Math.sin(t * 0.45) * 0.06;
            pivot.rotation.x = -pointer.look.y * 0.22 + scroll * 0.25;
            pivot.position.y = Math.sin(t * 0.8) * 0.04;
            rim.position.x = -2.5 + pointer.look.x * 2;
            // Model space is -0.5..0.5 tall: a wave every 5 s, then a pause
            glow.uSweep.value = ((t % 5) / 2.2) * 1.4 - 0.7;
          },
          render: () => {
            composer.render();
            if (!announced) {
              announced = true;
              readyRef.current?.();
            }
          },
          resize(w, h) {
            composer.setPixelRatio(renderer.getPixelRatio());
            composer.setSize(w, h);
          },
          dispose() {
            window.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointerdown', onDown);
            composer.dispose();
            env.dispose();
            pmrem.dispose();
          },
        };
      },
      { background: BG, fov: 30, z: 5.4 },
    );
  }, [src]);

  return <div ref={ref} className="absolute inset-0" style={STAGE_MASK} />;
}

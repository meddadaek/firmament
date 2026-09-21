import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, CylinderGeometry, DoubleSide, InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial } from 'three'
import { sim } from '@/state/sim'
import { tod } from './timeOfDay'
import { WATER_SURFACE, WORLD } from './generate'

const surfaceGeo = new CylinderGeometry(1, 1, 0.05, 6).translate(0, -0.025, 0)

const common = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uSky: { value: new Color() },
  uDeep: { value: new Color('#1f7fbf') },
  uShallow: { value: new Color('#5fd3e6') },
}

const surfaceMat = new ShaderMaterial({
  uniforms: common,
  transparent: true,
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uNight;
    uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow;
    varying vec3 vWorld;
    void main() {
      vec2 p = vWorld.xz;
      float w = sin(p.x * 2.1 + uTime * 1.3) * 0.5
              + sin(p.y * 2.7 - uTime * 1.1) * 0.5
              + sin((p.x + p.y) * 3.3 + uTime * 1.7) * 0.35;
      vec3 col = mix(uDeep, uShallow, smoothstep(-0.9, 1.1, w));
      col += smoothstep(1.02, 1.28, w) * 0.4;             // sparkles
      col = mix(col, uSky, 0.2);
      col *= mix(1.0, 0.3, uNight);
      col += vec3(0.1, 0.45, 0.8) * uNight * 0.3 * smoothstep(0.5, 1.25, w); // night shimmer
      gl_FragColor = vec4(col, 0.9);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
})

const FALL = 7.2

const fallMat = new ShaderMaterial({
  uniforms: common,
  transparent: true,
  depthWrite: false,
  side: DoubleSide,
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uNight; uniform vec3 uShallow;
    varying vec2 vUv;
    void main() {
      float fall = 1.0 - vUv.y;
      float streak = sin(vUv.x * 42.0 + sin(vUv.y * 9.0 + uTime) * 1.6) * 0.5 + 0.5;
      float flow = fract(vUv.y * 4.0 + uTime * 1.5);
      vec3 col = mix(uShallow, vec3(1.0), streak * 0.5 + smoothstep(0.75, 1.0, flow) * 0.3);
      col *= mix(1.0, 0.4, uNight);
      float alpha = (1.0 - smoothstep(0.45, 1.0, fall)) * (0.7 + 0.3 * streak);
      alpha *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
      gl_FragColor = vec4(col, alpha * 0.9);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
})

export function Water() {
  const ref = useRef<InstancedMesh>(null)
  const waterTiles = useMemo(() => WORLD.tiles.filter((t) => t.biome === 'water'), [])

  const fallGeo = useMemo(() => {
    const g = new PlaneGeometry(0.9, FALL, 1, 28)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) // +FALL/2 at the top → -FALL/2 at the bottom
      const d = FALL / 2 - y // distance fallen
      p.setXYZ(i, p.getX(i), -d, 0.04 + Math.pow(d, 1.35) * 0.1)
    }
    g.computeVertexNormals()
    return g
  }, [])

  useLayoutEffect(() => {
    const o = new Object3D()
    waterTiles.forEach((t, i) => {
      o.position.set(t.x, WATER_SURFACE, t.z)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.computeBoundingSphere()
  }, [waterTiles])

  useFrame(({ clock }) => {
    common.uTime.value = clock.elapsedTime
    common.uNight.value = sim.night
    common.uSky.value.copy(tod.skyTop)
  })

  const wf = WORLD.waterfall
  return (
    <group>
      <instancedMesh ref={ref} args={[surfaceGeo, surfaceMat, waterTiles.length]} />
      <mesh
        geometry={fallGeo}
        material={fallMat}
        position={[wf.x, wf.y, wf.z]}
        rotation-y={Math.atan2(wf.dirX, wf.dirZ)}
      />
    </group>
  )
}

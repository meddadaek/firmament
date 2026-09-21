import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Fog,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
} from 'three'
import { mulberry32, range } from '@/lib/random'
import { sim } from '@/state/sim'
import { sampleTimeOfDay, tod } from './timeOfDay'

const skyMat = new ShaderMaterial({
  side: BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new Color() },
    uBottom: { value: new Color() },
    uSun: { value: new Color() },
    uSunDir: { value: sim.sunDir },
    uNight: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uNight;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      vec3 col = mix(uBottom, uTop, smoothstep(-0.2, 0.7, d.y));
      col = mix(col, uBottom * 0.72, smoothstep(0.0, -0.9, d.y) * 0.55);  // deeper sky below the island
      float s = max(dot(d, uSunDir), 0.0);
      col += uSun * (smoothstep(0.9975, 0.999, s) * 1.4 + pow(s, 8.0) * 0.3) * (1.0 - uNight * 0.85);
      float m = max(dot(d, -uSunDir), 0.0);
      col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9982, 0.9992, m) * uNight;  // moon disc
      col += vec3(0.35, 0.45, 0.95) * pow(m, 24.0) * 0.22 * uNight;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
})

const starMat = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  uniforms: { uNight: { value: 0 }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute float aSize; attribute float aPhase;
    uniform float uTime;
    varying float vTwinkle;
    void main() {
      vTwinkle = 0.55 + 0.45 * sin(uTime * (1.2 + aPhase) + aPhase * 17.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uNight; varying float vTwinkle;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * uNight * vTwinkle;
      gl_FragColor = vec4(vec3(0.9, 0.93, 1.0), a);
    }`,
})

function Stars() {
  const geometry = useMemo(() => {
    const rng = mulberry32(3)
    const n = 900
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const phase = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const u = rng() * 2 - 1
      const y = Math.abs(u) * 0.95 + 0.02 // mostly above the horizon
      const a = rng() * Math.PI * 2
      const r = Math.sqrt(1 - y * y)
      pos.set([Math.cos(a) * r * 85, y * 85, Math.sin(a) * r * 85], i * 3)
      size[i] = range(rng, 1.2, 3.4)
      phase[i] = rng()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    g.setAttribute('aPhase', new BufferAttribute(phase, 1))
    return g
  }, [])
  return <points geometry={geometry} material={starMat} />
}

const cloudMat = new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: new Color('#ffffff'), emissiveIntensity: 0.12 })
const puffGeo = new IcosahedronGeometry(1, 1)

function Clouds() {
  const group = useRef<Group>(null)
  const mesh = useRef<InstancedMesh>(null)
  const puffs = useMemo(() => {
    const rng = mulberry32(21)
    const list: { x: number; y: number; z: number; s: number }[] = []
    for (let c = 0; c < 14; c++) {
      const a = (c / 14) * Math.PI * 2 + range(rng, -0.2, 0.2)
      const r = range(rng, 20, 34)
      const cy = c % 3 === 0 ? range(rng, 2, 6) : range(rng, -9, -4)
      const n = 4 + Math.floor(rng() * 4)
      for (let p = 0; p < n; p++) {
        list.push({
          x: Math.cos(a) * r + range(rng, -1.8, 1.8),
          y: cy + range(rng, -0.3, 0.6),
          z: Math.sin(a) * r + range(rng, -1.8, 1.8),
          s: range(rng, 0.9, 2.1),
        })
      }
    }
    return list
  }, [])

  useLayoutEffect(() => {
    const o = new Object3D()
    puffs.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z)
      o.scale.set(p.s, p.s * 0.72, p.s)
      o.updateMatrix()
      mesh.current!.setMatrixAt(i, o.matrix)
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [puffs])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.008
  })

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[puffGeo, cloudMat, puffs.length]} />
    </group>
  )
}

export function Sky() {
  const scene = useThree((s) => s.scene)
  const dome = useMemo(() => new SphereGeometry(95, 32, 20), [])

  useLayoutEffect(() => {
    scene.fog = new Fog('#d3ecff', 38, 120)
    return () => {
      scene.fog = null
    }
  }, [scene])

  useFrame(({ clock }) => {
    sampleTimeOfDay(sim.t)
    const u = skyMat.uniforms
    u.uTop.value.copy(tod.skyTop)
    u.uBottom.value.copy(tod.skyBottom)
    u.uSun.value.copy(tod.sun)
    u.uNight.value = sim.night
    starMat.uniforms.uNight.value = sim.night
    starMat.uniforms.uTime.value = clock.elapsedTime
    ;(scene.fog as Fog | null)?.color.copy(tod.skyBottom)
    cloudMat.emissive.copy(tod.skyBottom)
    cloudMat.emissiveIntensity = 0.1 + sim.night * 0.08
  })

  return (
    <group>
      <mesh geometry={dome} material={skyMat} renderOrder={-10} />
      <Stars />
      <Clouds />
    </group>
  )
}

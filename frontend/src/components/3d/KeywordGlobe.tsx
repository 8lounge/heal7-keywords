'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'

interface KeywordNode {
  id: number
  name: string
  category: string
  subcategory: string
  weight: number
  connections: number
  position?: [number, number, number]
  color?: string
  dependencies: number[]
  status: string
}

interface KeywordGlobeProps {
  keywords: KeywordNode[]
  onKeywordClick: (keyword: KeywordNode) => void
  selectedKeyword: KeywordNode | null
  isAnimating: boolean
}

function Keyword({ 
  keyword, 
  isSelected, 
  isConnected, 
  onClick,
  scale = 1 
}: {
  keyword: KeywordNode
  isSelected: boolean
  isConnected: boolean
  onClick: (keyword: KeywordNode) => void
  scale?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current) {
      // 부드러운 회전 애니메이션
      meshRef.current.rotation.y += 0.01
      
      // 선택된 키워드나 연결된 키워드 강조
      const targetScale = isSelected ? 1.5 : isConnected ? 1.2 : hovered ? 1.1 : 1
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
    }
  })

  return (
    <group position={keyword.position || [0, 0, 0]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick(keyword)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[0.1 * scale, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? '#ff6b6b' : isConnected ? '#4ecdc4' : keyword.color}
          emissive={isSelected ? '#ff6b6b' : isConnected ? '#4ecdc4' : keyword.color}
          emissiveIntensity={isSelected ? 0.3 : isConnected ? 0.2 : 0.1}
        />
      </mesh>
      
      {(isSelected || hovered) && (
        <Html distanceFactor={10}>
          <div className="bg-black/80 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap pointer-events-none">
            <div className="font-bold">{keyword.name}</div>
            <div className="text-xs opacity-75">{keyword.subcategory}</div>
            <div className="text-xs">연결: {keyword.connections}</div>
          </div>
        </Html>
      )}
    </group>
  )
}

function ConnectionLine({ 
  start, 
  end, 
  animated = true 
}: { 
  start: [number, number, number]
  end: [number, number, number]
  animated?: boolean 
}) {
  const lineRef = useRef<THREE.Line | null>(null)
  const [progress, setProgress] = useState(0)

  useFrame((state) => {
    if (animated && progress < 1) {
      setProgress(prev => Math.min(prev + 0.02, 1))
    }
  })

  const points = useMemo(() => {
    const startVec = new THREE.Vector3(...start)
    const endVec = new THREE.Vector3(...end)
    const curve = new THREE.QuadraticBezierCurve3(
      startVec,
      startVec.clone().lerp(endVec, 0.5).multiplyScalar(1.2),
      endVec
    )
    return curve.getPoints(50)
  }, [start, end])

  const visiblePoints = useMemo(() => {
    const count = Math.floor(points.length * progress)
    return points.slice(0, count)
  }, [points, progress])

  if (visiblePoints.length < 2) return null

  return (
    <line ref={lineRef as any}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={visiblePoints.length}
          array={new Float32Array(visiblePoints.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#4ecdc4" linewidth={2} transparent opacity={0.6} />
    </line>
  )
}

function Scene({ keywords, onKeywordClick, selectedKeyword, isAnimating }: KeywordGlobeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  useFrame((state) => {
    if (groupRef.current && !selectedKeyword) {
      // 지구본 자동 회전
      groupRef.current.rotation.y += 0.005
    }
  })

  const connectedKeywords = useMemo(() => {
    if (!selectedKeyword) return []
    return keywords.filter(k => 
      selectedKeyword.dependencies.includes(k.id) || 
      k.dependencies.includes(selectedKeyword.id)
    )
  }, [selectedKeyword, keywords])

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      <group ref={groupRef}>
        {/* 지구본 와이어프레임 */}
        <mesh>
          <sphereGeometry args={[2, 32, 32]} />
          <meshBasicMaterial 
            color="#333" 
            wireframe 
            transparent 
            opacity={0.1} 
          />
        </mesh>

        {/* 키워드 노드들 */}
        {keywords.map((keyword) => (
          keyword.position ? (
            <Keyword
              key={keyword.id}
              keyword={{
                ...keyword,
                position: keyword.position,
                color: keyword.color || '#888888'
              }}
              isSelected={selectedKeyword?.id === keyword.id}
              isConnected={connectedKeywords.some(k => k.id === keyword.id)}
              onClick={onKeywordClick}
              scale={keyword.weight / 5}
            />
          ) : null
        )).filter(Boolean)}

        {/* 연결선들 */}
        {selectedKeyword && selectedKeyword.position && connectedKeywords.map((connected) => (
          connected.position ? (
            <ConnectionLine
              key={`${selectedKeyword.id}-${connected.id}`}
              start={selectedKeyword.position}
              end={connected.position}
              animated={isAnimating}
            />
          ) : null
        )).filter(Boolean)}
      </group>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        zoomSpeed={0.6}
        panSpeed={0.8}
        rotateSpeed={0.4}
        minDistance={3}
        maxDistance={15}
      />
    </>
  )
}

export default function KeywordGlobe({ keywords, onKeywordClick, selectedKeyword, isAnimating }: KeywordGlobeProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <Scene
          keywords={keywords}
          onKeywordClick={onKeywordClick}
          selectedKeyword={selectedKeyword}
          isAnimating={isAnimating}
        />
      </Canvas>
    </div>
  )
}
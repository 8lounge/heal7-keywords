'use client'

import React, { useEffect, useRef, useCallback, useState } from 'react'
import { keywordApi, type KeywordData } from '@/lib/keywordApi'

// Three.js 동적 import로 메모리 최적화
let THREE: any = null
let OrbitControls: any = null

interface RealKeywordGlobeProps {
  keywords?: KeywordData[]
  onKeywordClick?: (keyword: KeywordData) => void
  selectedKeyword?: KeywordData | null
  isAnimating?: boolean
}

export default function RealKeywordGlobe({
  keywords = [],
  onKeywordClick,
  selectedKeyword,
  isAnimating = false
}: RealKeywordGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)
  const rendererRef = useRef<any>(null)
  const animationRef = useRef<number>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keywordData, setKeywordData] = useState<KeywordData[]>([])
  const [selectedKeywordState, setSelectedKeywordState] = useState<KeywordData | null>(null)

  // Three.js 초기화
  const initThreeJS = useCallback(async () => {
    if (!THREE) {
      THREE = await import('three')
      const { OrbitControls: OC } = await import('three/examples/jsm/controls/OrbitControls.js')
      OrbitControls = OC
    }

    if (!containerRef.current) return null

    const container = containerRef.current

    // Scene 생성
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000011) // 검은 우주 배경

    // Camera 설정
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    camera.position.set(0, 0, 8)

    // Renderer 생성
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // Controls 설정
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5
    controls.minDistance = 4
    controls.maxDistance = 15

    // 지구본 생성 (와이어프레임 구체)
    const globeGeometry = new THREE.SphereGeometry(3, 32, 32)
    const globeMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    })
    const globe = new THREE.Mesh(globeGeometry, globeMaterial)
    scene.add(globe)

    // 별 배경 생성
    const starsGeometry = new THREE.BufferGeometry()
    const starsCount = 2000
    const positions = new Float32Array(starsCount * 3)
    
    for (let i = 0; i < starsCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 100
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const starsMaterial = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 0.5,
      transparent: true,
      opacity: 0.8 
    })
    const stars = new THREE.Points(starsGeometry, starsMaterial)
    scene.add(stars)

    // 은하수 배경 (입자)
    const galaxyGeometry = new THREE.BufferGeometry()
    const galaxyCount = 5000
    const galaxyPositions = new Float32Array(galaxyCount * 3)
    const galaxyColors = new Float32Array(galaxyCount * 3)
    
    for (let i = 0; i < galaxyCount; i++) {
      const radius = Math.random() * 50 + 10
      const spinAngle = radius * 0.1
      const branchAngle = (i % 3) * ((Math.PI * 2) / 3)
      
      const randomX = (Math.random() - 0.5) * 2
      const randomY = (Math.random() - 0.5) * 2
      const randomZ = (Math.random() - 0.5) * 2
      
      galaxyPositions[i * 3] = Math.cos(branchAngle + spinAngle) * radius + randomX
      galaxyPositions[i * 3 + 1] = randomY
      galaxyPositions[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ
      
      const mixedColor = new THREE.Color()
      mixedColor.setHSL(0.6 + Math.random() * 0.4, 0.8, 0.6)
      galaxyColors[i * 3] = mixedColor.r
      galaxyColors[i * 3 + 1] = mixedColor.g  
      galaxyColors[i * 3 + 2] = mixedColor.b
    }
    
    galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3))
    galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3))
    
    const galaxyMaterial = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.4
    })
    
    const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial)
    scene.add(galaxy)

    return { scene, camera, renderer, controls, globe }
  }, [])

  // 키워드 데이터 로드
  const loadKeywords = useCallback(async () => {
    try {
      setError(null)
      let keywordList: KeywordData[]
      
      if (keywords.length > 0) {
        keywordList = keywords
      } else {
        const matrix = await keywordApi.getKeywordMatrix()
        keywordList = matrix.keywords
      }
      
      setKeywordData(keywordList)
      return keywordList
    } catch (err) {
      console.error('키워드 데이터 로드 실패:', err)
      setError('키워드 데이터를 불러올 수 없습니다.')
      return []
    }
  }, [keywords])

  // 키워드를 지구본에 배치
  const addKeywordsToGlobe = useCallback((keywordList: KeywordData[], scene: any) => {
    if (!THREE || keywordList.length === 0) return

    // 기존 키워드 노드 제거
    const existingNodes = scene.children.filter((child: any) => 
      child.userData && child.userData.type === 'keyword'
    )
    existingNodes.forEach((node: any) => scene.remove(node))

    // Golden Spiral 알고리즘으로 키워드 배치
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    
    keywordList.forEach((keyword, i) => {
      // 구체 표면 좌표 계산
      const theta = goldenAngle * i
      const y = 1 - (i / (keywordList.length - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const x = Math.cos(theta) * radius
      const z = Math.sin(theta) * radius

      // 키워드 노드 생성 (발광하는 구체)
      const nodeGeometry = new THREE.SphereGeometry(0.05, 8, 8)
      const nodeMaterial = new THREE.MeshBasicMaterial({
        color: keyword.color || '#3B82F6',
        transparent: true,
        opacity: 0.9
      })
      
      // 발광 효과 추가
      const glowGeometry = new THREE.SphereGeometry(0.08, 8, 8)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: keyword.color || '#3B82F6',
        transparent: true,
        opacity: 0.3
      })
      
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial)
      const glow = new THREE.Mesh(glowGeometry, glowMaterial)
      
      const position = new THREE.Vector3(x * 3.2, y * 3.2, z * 3.2)
      node.position.copy(position)
      glow.position.copy(position)
      
      // 키워드 데이터 저장
      node.userData = {
        type: 'keyword',
        keyword: keyword,
        originalColor: keyword.color || '#3B82F6',
        glow: glow
      }

      scene.add(node)
      scene.add(glow)

      // 연결선 생성 (일부 키워드만)
      if (i % 10 === 0 && i < keywordList.length - 10) {
        const nextKeyword = keywordList[i + 10]
        if (nextKeyword) {
          const nextTheta = goldenAngle * (i + 10)
          const nextY = 1 - ((i + 10) / (keywordList.length - 1)) * 2
          const nextRadius = Math.sqrt(1 - nextY * nextY)
          const nextX = Math.cos(nextTheta) * nextRadius
          const nextZ = Math.sin(nextTheta) * nextRadius
          
          const lineGeometry = new THREE.BufferGeometry()
          const linePositions = [
            x * 3.2, y * 3.2, z * 3.2,
            nextX * 3.2, nextY * 3.2, nextZ * 3.2
          ]
          lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
          
          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x4a90e2,
            transparent: true,
            opacity: 0.2
          })
          
          const line = new THREE.Line(lineGeometry, lineMaterial)
          line.userData = { type: 'connection' }
          scene.add(line)
        }
      }
    })

    console.log(`✅ ${keywordList.length}개 키워드를 3D 지구본에 배치 완료`)
  }, [])

  // 마우스 클릭 처리
  const handleClick = useCallback((event: MouseEvent) => {
    if (!sceneRef.current || !THREE) return

    const { scene, camera, renderer } = sceneRef.current
    const rect = renderer.domElement.getBoundingClientRect()
    
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)

    const keywordNodes = scene.children.filter((child: any) => 
      child.userData && child.userData.type === 'keyword'
    )
    
    const intersects = raycaster.intersectObjects(keywordNodes)
    
    if (intersects.length > 0) {
      const clickedKeyword = intersects[0].object.userData.keyword
      const newSelected = selectedKeywordState?.id === clickedKeyword.id ? null : clickedKeyword
      setSelectedKeywordState(newSelected)
      
      // 외부 콜백 호출
      if (onKeywordClick) {
        onKeywordClick(clickedKeyword)
      }
      
      // 모든 키워드 하이라이트 초기화
      keywordNodes.forEach((node: any) => {
        const originalColor = parseInt(node.userData.originalColor.replace('#', '0x'))
        node.material.color.setHex(originalColor)
        node.scale.setScalar(1)
        if (node.userData.glow) {
          node.userData.glow.material.color.setHex(originalColor)
          node.userData.glow.scale.setScalar(1)
        }
      })
      
      // 클릭된 키워드만 하이라이트
      if (newSelected) {
        const clickedNode = intersects[0].object
        clickedNode.material.color.setHex(0xff6b6b)
        clickedNode.scale.setScalar(2)
        if (clickedNode.userData.glow) {
          clickedNode.userData.glow.material.color.setHex(0xff6b6b)
          clickedNode.userData.glow.scale.setScalar(2)
        }
      }

      console.log('클릭된 키워드:', clickedKeyword.name)
    } else {
      // 빈 공간 클릭 시 선택 해제
      setSelectedKeywordState(null)
      
      // 모든 하이라이트 제거
      keywordNodes.forEach((node: any) => {
        const originalColor = parseInt(node.userData.originalColor.replace('#', '0x'))
        node.material.color.setHex(originalColor)
        node.scale.setScalar(1)
        if (node.userData.glow) {
          node.userData.glow.material.color.setHex(originalColor)
          node.userData.glow.scale.setScalar(1)
        }
      })
    }
  }, [selectedKeywordState, onKeywordClick])

  // 애니메이션 루프
  const animate = useCallback(() => {
    if (!sceneRef.current) return

    const { scene, camera, renderer, controls } = sceneRef.current
    
    controls.update()
    
    // 지구본과 별들 회전
    const globe = scene.children.find((child: any) => 
      child.type === 'Mesh' && child.geometry.type === 'SphereGeometry' && child.material.wireframe
    )
    if (globe) {
      globe.rotation.y += 0.002
    }
    
    const stars = scene.children.find((child: any) => child.type === 'Points')
    if (stars) {
      stars.rotation.y += 0.0005
    }

    renderer.render(scene, camera)
    animationRef.current = requestAnimationFrame(animate)
  }, [])

  // 초기화
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Three.js 초기화
        const threeComponents = await initThreeJS()
        if (!mounted || !threeComponents) return

        sceneRef.current = threeComponents
        rendererRef.current = threeComponents.renderer

        // 키워드 데이터 로드
        const keywordList = await loadKeywords()
        if (!mounted || keywordList.length === 0) return

        // 키워드를 지구본에 배치
        addKeywordsToGlobe(keywordList, threeComponents.scene)

        // 클릭 이벤트 리스너 추가
        threeComponents.renderer.domElement.addEventListener('click', handleClick)

        // 애니메이션 시작
        animate()

        setIsLoading(false)
      } catch (error) {
        console.error('3D Globe 초기화 실패:', error)
        setError('3D Globe를 초기화할 수 없습니다.')
        setIsLoading(false)
      }
    }

    init()

    return () => {
      mounted = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      
      // 리소스 정리
      if (rendererRef.current) {
        const canvas = rendererRef.current.domElement
        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas)
        }
        rendererRef.current.dispose()
      }
      
      if (sceneRef.current && sceneRef.current.renderer) {
        sceneRef.current.renderer.domElement.removeEventListener('click', handleClick)
      }
    }
  }, [initThreeJS, loadKeywords, addKeywordsToGlobe, handleClick, animate])

  // 윈도우 리사이즈 처리
  useEffect(() => {
    const handleResize = () => {
      if (!sceneRef.current || !containerRef.current) return

      const { camera, renderer } = sceneRef.current
      const container = containerRef.current

      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="text-center">
          <div className="w-20 h-20 relative mx-auto mb-6">
            <div className="w-full h-full border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-2 border-4 border-purple-500 border-b-transparent rounded-full animate-spin animate-reverse"></div>
            <div className="absolute inset-4 border-4 border-green-500 border-l-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">🌍 3D 키워드 지구본 생성 중</h3>
          <p className="text-blue-300 mb-1">Three.js WebGL 엔진 초기화</p>
          <p className="text-sm text-gray-400">442개 키워드 + 우주 배경 렌더링</p>
          <div className="mt-4 flex justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 to-black">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">⚠️</span>
          </div>
          <p className="text-white mb-2 font-semibold">3D Globe 로딩 실패</p>
          <p className="text-sm text-red-200">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />
      
      {/* 선택된 키워드 정보 표시 */}
      {selectedKeywordState && (
        <div className="absolute top-4 right-4 bg-black/90 backdrop-blur-sm rounded-xl p-6 text-white max-w-sm border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl text-blue-300">{selectedKeywordState.name}</h3>
            <button 
              onClick={() => setSelectedKeywordState(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">카테고리:</span> 
              <span className="font-medium">{selectedKeywordState.category} 그룹</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">서브카테고리:</span> 
              <span className="font-medium">{selectedKeywordState.subcategory}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">가중치:</span> 
              <span className="font-medium">{selectedKeywordState.weight?.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">연결 수:</span> 
              <span className="font-medium">{selectedKeywordState.connections}개</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">상태:</span> 
              <span className={`font-medium ${selectedKeywordState.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                {selectedKeywordState.status === 'active' ? '활성' : '비활성'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 컨트롤 힌트 */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="font-medium">3D WebGL Globe 실행 중</span>
          </div>
          <div>🖱️ <strong>드래그</strong>: 회전</div>
          <div>🔍 <strong>휠</strong>: 줌</div>
          <div>👆 <strong>클릭</strong>: 키워드 선택</div>
          <div>🌍 <strong>자동</strong>: 회전 중</div>
        </div>
      </div>

      {/* 통계 정보 */}
      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
        <div className="space-y-1 text-sm">
          <div className="font-semibold text-blue-300">키워드 매트릭스</div>
          <div>{keywordData.length}개 키워드 로드됨</div>
          <div>Golden Spiral 알고리즘 배치</div>
          <div>실시간 3D 렌더링</div>
        </div>
      </div>
    </div>
  )
}
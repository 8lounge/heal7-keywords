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

// 애니메이션 상태 타입
type ViewMode = '3d' | '2d'

interface AnimationState {
  viewMode: ViewMode
  isTransitioning: boolean
  focusedKeyword: KeywordData | null
  originalPositions: Map<string, any>
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
  const [animationState, setAnimationState] = useState<AnimationState>({
    viewMode: '3d',
    isTransitioning: false,
    focusedKeyword: null,
    originalPositions: new Map()
  })
  const animationTweensRef = useRef<any[]>([])

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

    // 원본 위치 저장용 Map 초기화
    const originalPositions = new Map<string, any>()

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
      
      // 원본 위치 저장
      originalPositions.set(keyword.id, position.clone())
      
      // 키워드 데이터 저장 (연결 관계 추가)
      node.userData = {
        type: 'keyword',
        keyword: keyword,
        originalColor: keyword.color || '#3B82F6',
        glow: glow,
        connections: getKeywordConnections(keyword, keywordList) // 연결 관계 계산
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

    // 원본 위치 상태 업데이트
    setAnimationState(prev => ({
      ...prev,
      originalPositions
    }))

    console.log(`✅ ${keywordList.length}개 키워드를 3D 지구본에 배치 완료`)
  }, [])

  // 키워드 연결 관계 계산 함수
  const getKeywordConnections = useCallback((keyword: KeywordData, keywordList: KeywordData[]) => {
    // 같은 카테고리나 서브카테고리의 키워드들을 연결로 간주
    return keywordList.filter(k => 
      k.id !== keyword.id && 
      (k.category === keyword.category || k.subcategory === keyword.subcategory)
    ).slice(0, 8) // 최대 8개 연결로 제한
  }, [])

  // 원자-전자 2D 관계도 전환 함수
  const transitionTo2D = useCallback((centerKeyword: KeywordData, centerNode: any, scene: any, camera: any, controls: any) => {
    if (animationState.isTransitioning) return
    
    console.log(`🔄 원자-전자 2D 관계도 전환 시작: ${centerKeyword.name}`)
    
    setAnimationState(prev => ({ 
      ...prev, 
      isTransitioning: true, 
      viewMode: '2d', 
      focusedKeyword: centerKeyword 
    }))
    
    // 기존 애니메이션 정리
    animationTweensRef.current.forEach(tween => {
      if (tween && tween.kill) tween.kill()
    })
    animationTweensRef.current = []
    
    // 연결된 키워드들 찾기
    const connectedKeywords = centerNode.userData.connections || []
    const allKeywordNodes = scene.children.filter((child: any) => 
      child.userData && child.userData.type === 'keyword'
    )
    
    // 레이아웃 중심점
    const layoutCenter = new THREE.Vector3(0, 0, 0)
    
    // 1. 중심 키워드를 (0,0,0)으로 이동
    const centerTween = createPositionTween(centerNode, layoutCenter, 1.2)
    animationTweensRef.current.push(centerTween)
    
    // 중심 키워드 색상 변경 (밝은 오렌지)
    const centerColorTween = createColorTween(centerNode, 0xff6b35, 1.0)
    animationTweensRef.current.push(centerColorTween)
    
    // 2. 연결된 키워드들을 방사형 배치
    if (connectedKeywords.length > 0) {
      const baseRadius = 3.5
      const radiusIncrement = Math.max(0.5, connectedKeywords.length * 0.1)
      const circleRadius = baseRadius + radiusIncrement
      const angleIncrement = (Math.PI * 2) / connectedKeywords.length
      
      connectedKeywords.forEach((keyword: KeywordData, index: number) => {
        const connectedNode = allKeywordNodes.find((node: any) => 
          node.userData.keyword.id === keyword.id
        )
        
        if (connectedNode) {
          const angle = angleIncrement * index
          const newPosition = new THREE.Vector3(
            circleRadius * Math.cos(angle),
            circleRadius * Math.sin(angle),
            0 // 2D 평면
          )
          
          const positionTween = createPositionTween(connectedNode, newPosition, 1.2, 0.1 * index)
          const colorTween = createColorTween(connectedNode, 0x3b82f6, 1.0, 0.1 * index) // 파란색
          
          animationTweensRef.current.push(positionTween, colorTween)
        }
      })
      
      console.log(`📐 방사형 레이아웃: ${connectedKeywords.length}개 키워드, 반지름 ${circleRadius}`)
    }
    
    // 3. 연결되지 않은 키워드들은 뒤로 이동 및 투명도 조정
    allKeywordNodes.forEach((node: any) => {
      const isCenter = node.userData.keyword.id === centerKeyword.id
      const isConnected = connectedKeywords.some((k: KeywordData) => k.id === node.userData.keyword.id)
      
      if (!isCenter && !isConnected) {
        const hideTween = createPositionTween(node, new THREE.Vector3(
          node.position.x * 0.3,
          node.position.y * 0.3, 
          node.position.z - 5
        ), 1.0, 0.2)
        const fadeOut = createOpacityTween(node, 0.1, 1.0, 0.2)
        
        animationTweensRef.current.push(hideTween, fadeOut)
      }
    })
    
    // 4. 카메라 프레이밍
    const numConnected = connectedKeywords.length
    const optimalDistance = numConnected > 10 ? 12 : numConnected > 5 ? 10 : 8
    const newCameraPos = new THREE.Vector3(0.2, 0.1, optimalDistance)
    
    const cameraTween = createPositionTween(camera, newCameraPos, 1.5)
    const targetTween = createPositionTween(controls.target, layoutCenter, 1.5)
    
    animationTweensRef.current.push(cameraTween, targetTween)
    
    // 5. 애니메이션 완료 후 상태 업데이트
    setTimeout(() => {
      setAnimationState(prev => ({ ...prev, isTransitioning: false }))
      console.log(`✅ 2D 관계도 전환 완료`)
    }, 1500)
    
  }, [animationState.isTransitioning])
  
  // 3D 뷰로 복귀 함수
  const transitionTo3D = useCallback((scene: any, camera: any, controls: any) => {
    if (animationState.isTransitioning) return
    
    console.log('🌍 3D Globe 뷰로 복귀 시작')
    
    setAnimationState(prev => ({ 
      ...prev, 
      isTransitioning: true, 
      viewMode: '3d', 
      focusedKeyword: null 
    }))
    
    // 기존 애니메이션 정리
    animationTweensRef.current.forEach(tween => {
      if (tween && tween.kill) tween.kill()
    })
    animationTweensRef.current = []
    
    const allKeywordNodes = scene.children.filter((child: any) => 
      child.userData && child.userData.type === 'keyword'
    )
    
    // 모든 키워드를 원래 위치로 복귀
    allKeywordNodes.forEach((node: any) => {
      const keyword = node.userData.keyword
      const originalPosition = animationState.originalPositions.get(keyword.id)
      const originalColor = parseInt(node.userData.originalColor.replace('#', '0x'))
      
      if (originalPosition) {
        const positionTween = createPositionTween(node, originalPosition, 1.2)
        const colorTween = createColorTween(node, originalColor, 1.0)
        const opacityTween = createOpacityTween(node, 0.9, 1.0)
        
        animationTweensRef.current.push(positionTween, colorTween, opacityTween)
      }
    })
    
    // 카메라를 원래 위치로 복귀
    const originalCameraPos = new THREE.Vector3(0, 0, 8)
    const cameraTween = createPositionTween(camera, originalCameraPos, 1.5)
    const targetTween = createPositionTween(controls.target, new THREE.Vector3(0, 0, 0), 1.5)
    
    animationTweensRef.current.push(cameraTween, targetTween)
    
    // 애니메이션 완료 후 상태 업데이트
    setTimeout(() => {
      setAnimationState(prev => ({ ...prev, isTransitioning: false }))
      console.log('✅ 3D Globe 복귀 완료')
    }, 1500)
    
  }, [animationState.isTransitioning, animationState.originalPositions])
  
  // 위치 애니메이션 생성 헬퍼
  const createPositionTween = useCallback((object: any, targetPosition: any, duration: number, delay: number = 0) => {
    let startTime = Date.now() + delay * 1000
    let completed = false
    
    const startPosition = object.position.clone()
    
    const tween = {
      update: () => {
        if (completed) return true
        
        const now = Date.now()
        if (now < startTime) return false
        
        const elapsed = (now - startTime) / 1000
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function (power2.out)
        const easedProgress = 1 - Math.pow(1 - progress, 2)
        
        object.position.lerpVectors(startPosition, targetPosition, easedProgress)
        
        // Glow 효과도 함께 이동
        if (object.userData.glow) {
          object.userData.glow.position.copy(object.position)
        }
        
        if (progress >= 1) {
          completed = true
          return true
        }
        
        return false
      },
      kill: () => { completed = true }
    }
    
    return tween
  }, [])
  
  // 색상 애니메이션 생성 헬퍼
  const createColorTween = useCallback((object: any, targetColor: number, duration: number, delay: number = 0) => {
    let startTime = Date.now() + delay * 1000
    let completed = false
    
    const startColor = object.material.color.clone()
    const endColor = new THREE.Color(targetColor)
    
    const tween = {
      update: () => {
        if (completed) return true
        
        const now = Date.now()
        if (now < startTime) return false
        
        const elapsed = (now - startTime) / 1000
        const progress = Math.min(elapsed / duration, 1)
        
        const easedProgress = 1 - Math.pow(1 - progress, 2)
        
        object.material.color.lerpColors(startColor, endColor, easedProgress)
        
        // Glow 색상도 함께 변경
        if (object.userData.glow) {
          object.userData.glow.material.color.lerpColors(startColor, endColor, easedProgress)
        }
        
        if (progress >= 1) {
          completed = true
          return true
        }
        
        return false
      },
      kill: () => { completed = true }
    }
    
    return tween
  }, [])
  
  // 투명도 애니메이션 생성 헬퍼
  const createOpacityTween = useCallback((object: any, targetOpacity: number, duration: number, delay: number = 0) => {
    let startTime = Date.now() + delay * 1000
    let completed = false
    
    const startOpacity = object.material.opacity
    
    const tween = {
      update: () => {
        if (completed) return true
        
        const now = Date.now()
        if (now < startTime) return false
        
        const elapsed = (now - startTime) / 1000
        const progress = Math.min(elapsed / duration, 1)
        
        const easedProgress = 1 - Math.pow(1 - progress, 2)
        
        object.material.opacity = startOpacity + (targetOpacity - startOpacity) * easedProgress
        
        if (object.userData.glow) {
          object.userData.glow.material.opacity = object.material.opacity * 0.3
        }
        
        if (progress >= 1) {
          completed = true
          return true
        }
        
        return false
      },
      kill: () => { completed = true }
    }
    
    return tween
  }, [])

  // 마우스 클릭 처리
  const handleClick = useCallback((event: MouseEvent) => {
    if (!sceneRef.current || !THREE || animationState.isTransitioning) return

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
      const clickedNode = intersects[0].object
      const { controls } = sceneRef.current
      
      // 동일한 키워드 클릭 시 처리
      if (selectedKeywordState?.id === clickedKeyword.id) {
        // 2D 뷰에서는 3D로 복귀, 3D 뷰에서는 2D로 전환
        if (animationState.viewMode === '2d') {
          transitionTo3D(scene, camera, controls)
          setSelectedKeywordState(null)
        } else {
          transitionTo2D(clickedKeyword, clickedNode, scene, camera, controls)
        }
      } else {
        // 새로운 키워드 선택
        setSelectedKeywordState(clickedKeyword)
        
        // 3D 뷰에서는 2D 관계도로 전환
        if (animationState.viewMode === '3d') {
          transitionTo2D(clickedKeyword, clickedNode, scene, camera, controls)
        }
      }
      
      // 외부 콜백 호출
      if (onKeywordClick) {
        onKeywordClick(clickedKeyword)
      }

      console.log('클릭된 키워드:', clickedKeyword.name, '| 뷰 모드:', animationState.viewMode)
    } else {
      // 빈 공간 클릭 시 3D로 복귀
      if (animationState.viewMode === '2d') {
        const { controls } = sceneRef.current
        transitionTo3D(scene, camera, controls)
        setSelectedKeywordState(null)
      } else {
        setSelectedKeywordState(null)
        
        // 3D에서는 하이라이트 제거
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
    }
  }, [selectedKeywordState, onKeywordClick, animationState, transitionTo2D, transitionTo3D])

  // 애니메이션 루프
  const animate = useCallback(() => {
    if (!sceneRef.current) return

    const { scene, camera, renderer, controls } = sceneRef.current
    
    controls.update()
    
    // 커스텀 애니메이션 업데이트
    animationTweensRef.current = animationTweensRef.current.filter(tween => {
      if (tween && tween.update) {
        return !tween.update() // false를 반환하면 계속 실행, true를 반환하면 완료
      }
      return false
    })
    
    // 지구본과 별들 회전 (3D 모드에서만)
    if (animationState.viewMode === '3d') {
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
    }

    renderer.render(scene, camera)
    animationRef.current = requestAnimationFrame(animate)
  }, [animationState.viewMode])

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
              onClick={() => {
                if (animationState.viewMode === '2d' && sceneRef.current) {
                  const { scene, camera, controls } = sceneRef.current
                  transitionTo3D(scene, camera, controls)
                }
                setSelectedKeywordState(null)
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">뷰 모드:</span> 
              <span className={`font-medium ${animationState.viewMode === '2d' ? 'text-orange-400' : 'text-blue-400'}`}>
                {animationState.viewMode === '2d' ? '🔬 원자-전자 2D' : '🌍 3D Globe'}
              </span>
            </div>
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
          
          {/* 뷰 전환 버튼 */}
          {!animationState.isTransitioning && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (sceneRef.current) {
                    const { scene, camera, controls } = sceneRef.current
                    if (animationState.viewMode === '3d') {
                      const keywordNodes = scene.children.filter((child: any) => 
                        child.userData && child.userData.type === 'keyword'
                      )
                      const centerNode = keywordNodes.find((node: any) => 
                        node.userData.keyword.id === selectedKeywordState.id
                      )
                      if (centerNode) {
                        transitionTo2D(selectedKeywordState, centerNode, scene, camera, controls)
                      }
                    } else {
                      transitionTo3D(scene, camera, controls)
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  animationState.viewMode === '2d' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {animationState.viewMode === '2d' ? '🌍 3D Globe' : '🔬 2D 관계도'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 컨트롤 힌트 */}
      <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              animationState.viewMode === '2d' ? 'bg-orange-400' : 'bg-green-400'
            }`}></div>
            <span className="font-medium">
              {animationState.viewMode === '2d' ? '🔬 원자-전자 2D 관계도' : '🌍 3D WebGL Globe'} 실행 중
            </span>
          </div>
          {animationState.isTransitioning ? (
            <div className="text-yellow-300">⏳ <strong>전환 중...</strong></div>
          ) : (
            <>
              <div>🖱️ <strong>드래그</strong>: 회전</div>
              <div>🔍 <strong>휠</strong>: 줌</div>
              <div>👆 <strong>클릭</strong>: {animationState.viewMode === '2d' ? '3D 복귀' : '2D 관계도'}</div>
              {animationState.viewMode === '3d' && <div>🌍 <strong>자동</strong>: 회전 중</div>}
              {animationState.viewMode === '2d' && animationState.focusedKeyword && (
                <div>🔬 <strong>중심</strong>: {animationState.focusedKeyword.name}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 통계 정보 */}
      <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
        <div className="space-y-1 text-sm">
          <div className="font-semibold text-blue-300">
            {animationState.viewMode === '2d' ? '원자-전자 관계도' : '키워드 매트릭스'}
          </div>
          <div>{keywordData.length}개 키워드 로드됨</div>
          {animationState.viewMode === '2d' ? (
            <>
              <div>방사형 2D 레이아웃</div>
              <div>중심-종속 관계 표시</div>
              {animationState.focusedKeyword && (
                <div>연결: {getKeywordConnections(animationState.focusedKeyword, keywordData).length}개</div>
              )}
            </>
          ) : (
            <>
              <div>Golden Spiral 알고리즘 배치</div>
              <div>실시간 3D 렌더링</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
'use client'

import React, { useEffect, useRef, useCallback, useState } from 'react'
import { keywordApi, type KeywordData } from '@/lib/keywordApi'

// Three.js 정적 import - 동적 import 문제 해결
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

interface OptimizedKeywordGlobeProps {
  keywords?: KeywordData[]
  onKeywordClick?: (keyword: KeywordData) => void
  selectedKeyword?: KeywordData | null
  isAnimating?: boolean
  width?: number
  height?: number
}

interface ThreeJSComponents {
  scene: any
  camera: any
  renderer: any
  labelRenderer: any
  controls: any
  raycaster: any
  group: any
  nodes: Record<string, any>
  hitboxes: any[]
}

export default function OptimizedKeywordGlobe({
  keywords = [],
  onKeywordClick,
  selectedKeyword,
  isAnimating = false,
  width,
  height
}: OptimizedKeywordGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const threeRef = useRef<ThreeJSComponents | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [threeJSReady, setThreeJSReady] = useState(false)
  const [keywordData, setKeywordData] = useState<Record<string, string[]>>({})
  const animationRef = useRef<number>()
  const mouseRef = useRef({ x: -100, y: -100 })
  const interactionRef = useRef({
    hasUserInteracted: false,
    highlightedNode: null,
    isHovering: false,
    isFocused: false
  })

  // 🚀 Advanced Performance Optimizations
  const [performanceSettings] = useState({
    enableLOD: true,          // Level of Detail
    enableFrustumCulling: true, // Viewport culling
    maxVisibleNodes: 300,     // Adaptive LOD limit
    textUpdateThrottle: 100,  // ms
    hoverResponseTime: 50,    // ms
    animationFrameSkip: 0     // Skip frames for better performance
  })

  // 📦 Load keyword data and initialize Three.js
  const loadKeywordData = useCallback(async () => {
    try {
      setLoadProgress(20)
      
      // Load keyword data if not provided
      if (keywords.length === 0) {
        const matrixData = await keywordApi.getKeywordMatrix()
        setLoadProgress(60)
        
        // Build dependency mapping for connection visualization
        const dependencyMap: Record<string, string[]> = {}
        matrixData.keywords.forEach(keyword => {
          dependencyMap[keyword.name] = []
          if (keyword.dependencies && keyword.dependencies.length > 0) {
            keyword.dependencies.forEach(depId => {
              const depKeyword = matrixData.keywords.find(k => k.id === depId)
              if (depKeyword) {
                dependencyMap[keyword.name].push(depKeyword.name)
              }
            })
          }
        })
        setKeywordData(dependencyMap)
      }

      setLoadProgress(100)
      setThreeJSReady(true)
      console.log('✅ Three.js static import successful, keyword data loaded')
    } catch (error) {
      console.error('❌ Keyword data loading failed:', error)
      setThreeJSReady(false)
      // 에러 발생 시 로딩 상태 해제
      setIsLoading(false)
    }
  }, [keywords.length])

  // 🎯 Golden Spiral algorithm for uniform sphere distribution
  const generateSpherePoints = useCallback((count: number, radius: number = 50) => {
    const points: [number, number, number][] = []
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const radiusAtY = Math.sqrt(1 - y * y)
      const theta = goldenAngle * i
      
      const x = Math.cos(theta) * radiusAtY
      const z = Math.sin(theta) * radiusAtY
      
      points.push([x * radius, y * radius, z * radius])
    }
    
    return points
  }, [])

  // 🎨 Category color mapping
  const getCategoryColor = useCallback((category: string) => {
    const colors: Record<string, string> = {
      'A': '#3B82F6', // Blue
      'B': '#EC4899', // Pink  
      'C': '#F59E0B'  // Orange
    }
    return colors[category] || '#6B7280'
  }, [])

  // 🏗️ Initialize Three.js scene with performance optimizations
  const initializeThreeJS = useCallback(async () => {
    if (!containerRef.current || !threeJSReady) return

    const container = containerRef.current
    
    try {
      // Scene setup with optimized settings
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0c0a09)
      
      // Camera with adaptive FOV
      const camera = new THREE.PerspectiveCamera(
        75, 
        (width || container.clientWidth) / (height || container.clientHeight), 
        0.1, 
        1000
      )
      camera.position.set(0, 0, 150)
      
      // Renderer with performance optimizations
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true
      })
      renderer.setSize(width || container.clientWidth, height || container.clientHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // Cap pixel ratio for performance
      renderer.outputColorSpace = THREE.SRGBColorSpace
      
      // Enable frustum culling (자동으로 활성화됨)
      
      container.appendChild(renderer.domElement)

      // CSS2D Label Renderer
      const labelRenderer = new CSS2DRenderer()
      labelRenderer.setSize(width || container.clientWidth, height || container.clientHeight)
      labelRenderer.domElement.style.position = 'absolute'
      labelRenderer.domElement.style.top = '0px'
      labelRenderer.domElement.style.pointerEvents = 'none'
      container.appendChild(labelRenderer.domElement)

      // Controls with optimized settings
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 10
      controls.maxDistance = 300
      controls.enablePan = true
      controls.maxPolarAngle = Math.PI

      // Raycaster for interactions
      const raycaster = new THREE.Raycaster()
      raycaster.params.Points.threshold = 5 // Optimize click detection

      // Main group for all 3D objects
      const group = new THREE.Group()
      scene.add(group)

      // Store components
      const components: ThreeJSComponents = {
        scene,
        camera,
        renderer,
        labelRenderer,
        controls,
        raycaster,
        group,
        nodes: {},
        hitboxes: []
      }
      
      threeRef.current = components

      // Create keyword nodes with LOD optimization
      await createOptimizedKeywordNodes(components)
      
      // Setup event listeners
      setupEventListeners(components)
      
      // Start animation loop
      startAnimationLoop(components)
      
      setIsLoading(false)
      console.log('🎉 Optimized 3D visualization initialized')
      
    } catch (error) {
      console.error('❌ Three.js initialization failed:', error)
      setIsLoading(false)
      setThreeJSReady(false)
    }
  }, [threeJSReady, keywords, width, height, performanceSettings, generateSpherePoints, getCategoryColor])

  // 🧩 Create keyword nodes with advanced LOD system
  const createOptimizedKeywordNodes = useCallback(async (components: ThreeJSComponents) => {
    const activeKeywords = keywords.length > 0 ? keywords : []
    if (activeKeywords.length === 0) return

    const { scene, group, nodes, hitboxes } = components
    
    // Generate optimized sphere positions
    const positions = generateSpherePoints(activeKeywords.length, 50)
    
    // LOD system: Create different detail levels
    const createNodeGeometry = (detailLevel: 'high' | 'medium' | 'low') => {
      const segments = detailLevel === 'high' ? 16 : detailLevel === 'medium' ? 12 : 8
      return new THREE.SphereGeometry(1.2, segments, segments)
    }
    
    // Batch geometry creation for performance
    const highDetailGeo = createNodeGeometry('high')
    const mediumDetailGeo = createNodeGeometry('medium')
    const lowDetailGeo = createNodeGeometry('low')
    
    activeKeywords.forEach((keyword, index) => {
      const position = positions[index]
      
      // LOD-based geometry selection
      const useHighDetail = index < performanceSettings.maxVisibleNodes * 0.3
      const useMediumDetail = index < performanceSettings.maxVisibleNodes * 0.7
      const geometry = useHighDetail ? highDetailGeo : useMediumDetail ? mediumDetailGeo : lowDetailGeo
      
      // Material with category-based coloring
      const material = new THREE.MeshBasicMaterial({
        color: getCategoryColor(keyword.category),
        transparent: true,
        opacity: 0.8
      })
      
      // Create mesh
      const sphere = new THREE.Mesh(geometry, material)
      sphere.position.set(position[0], position[1], position[2])
      sphere.userData = { keyword, originalColor: getCategoryColor(keyword.category) }
      
      // Text label with adaptive rendering
      const labelDiv = document.createElement('div')
      labelDiv.className = 'keyword-label'
      labelDiv.style.cssText = `
        color: #e5e7eb;
        font-size: 14px;
        text-shadow: 0 0 8px #000;
        transition: opacity 0.3s, font-size 0.3s;
        pointer-events: none;
        font-family: 'Noto Sans KR', sans-serif;
      `
      labelDiv.textContent = keyword.name
      
      const label = new CSS2DObject(labelDiv)
      label.position.set(position[0], position[1], position[2])
      
      // Add to scene
      group.add(sphere)
      group.add(label)
      
      // Store references
      nodes[keyword.name] = {
        mesh: sphere,
        label: label,
        keyword: keyword,
        originalColor: getCategoryColor(keyword.category),
        detailLevel: useHighDetail ? 'high' : useMediumDetail ? 'medium' : 'low'
      }
      
      hitboxes.push(sphere)
    })
    
    console.log(`✨ Created ${Object.keys(nodes).length} optimized keyword nodes with LOD`)
  }, [keywords, performanceSettings, generateSpherePoints, getCategoryColor])

  // 🎮 Setup event listeners with throttling
  const setupEventListeners = useCallback((components: ThreeJSComponents) => {
    const { renderer, raycaster, camera, hitboxes } = components
    
    // Throttled mouse move handler
    let mouseMoveTimeout: NodeJS.Timeout
    const handleMouseMove = (event: MouseEvent) => {
      clearTimeout(mouseMoveTimeout)
      mouseMoveTimeout = setTimeout(() => {
        const rect = renderer.domElement.getBoundingClientRect()
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        interactionRef.current.hasUserInteracted = true
      }, performanceSettings.hoverResponseTime)
    }
    
    // Optimized click handler
    const handleClick = (event: MouseEvent) => {
      const mouse = mouseRef.current
      raycaster.setFromCamera({ x: mouse.x, y: mouse.y }, camera)
      const intersects = raycaster.intersectObjects(hitboxes)
      
      if (intersects.length > 0) {
        const clickedObject = intersects[0].object
        const keyword = clickedObject.userData.keyword
        
        if (keyword && onKeywordClick) {
          console.log(`🎯 Clicked keyword: ${keyword.name}`)
          onKeywordClick(keyword)
        }
      }
    }
    
    // Window resize handler
    const handleResize = () => {
      if (!containerRef.current) return
      
      const newWidth = width || containerRef.current.clientWidth
      const newHeight = height || containerRef.current.clientHeight
      
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
      components.labelRenderer.setSize(newWidth, newHeight)
    }
    
    renderer.domElement.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('click', handleClick)
    window.addEventListener('resize', handleResize)
    
    // Cleanup function
    return () => {
      renderer.domElement.removeEventListener('mousemove', handleMouseMove)
      renderer.domElement.removeEventListener('click', handleClick)
      window.removeEventListener('resize', handleResize)
      clearTimeout(mouseMoveTimeout)
    }
  }, [onKeywordClick, width, height, performanceSettings])

  // 🎬 Start optimized animation loop
  const startAnimationLoop = useCallback((components: ThreeJSComponents) => {
    const { scene, camera, renderer, labelRenderer, controls, raycaster, hitboxes, nodes, group } = components
    let frameCount = 0
    
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate)
      
      // Frame skipping for performance
      frameCount++
      if (frameCount % (performanceSettings.animationFrameSkip + 1) !== 0) {
        return
      }
      
      const interaction = interactionRef.current
      
      // Auto-rotation when not interacting
      if (!interaction.hasUserInteracted && !interaction.isFocused) {
        group.rotation.y += 0.005
      }
      
      // Hover detection with performance optimization
      if (interaction.hasUserInteracted) {
        const mouse = mouseRef.current
        raycaster.setFromCamera({ x: mouse.x, y: mouse.y }, camera)
        const intersects = raycaster.intersectObjects(hitboxes)
        
        if (intersects.length > 0 && !interaction.isHovering) {
          const hoveredObject = intersects[0].object
          const keyword = hoveredObject.userData.keyword
          
          if (keyword && interaction.highlightedNode !== keyword.name) {
            hoveredObject.material.color.setHex(0xFFFFFF)
            hoveredObject.material.opacity = 1.0
            interaction.highlightedNode = keyword.name
            interaction.isHovering = true
          }
        } else if (intersects.length === 0 && interaction.isHovering) {
          // Reset hover state
          if (interaction.highlightedNode && nodes[interaction.highlightedNode]) {
            const node = nodes[interaction.highlightedNode]
            node.mesh.material.color.setStyle(node.originalColor)
            node.mesh.material.opacity = 0.8
          }
          interaction.highlightedNode = null
          interaction.isHovering = false
        }
      }
      
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    }
    
    animate()
  }, [performanceSettings])

  // 🔄 Handle selected keyword changes
  useEffect(() => {
    if (selectedKeyword && threeRef.current) {
      const { nodes, camera, controls } = threeRef.current
      const node = nodes[selectedKeyword.name]
      
      if (node) {
        // Focus camera on selected keyword
        const targetPosition = node.mesh.position.clone()
        targetPosition.multiplyScalar(1.5)
        
        camera.position.copy(targetPosition)
        controls.target.copy(node.mesh.position)
        controls.update()
        
        // Highlight connections
        highlightConnections(selectedKeyword.name)
        interactionRef.current.isFocused = true
      }
    } else if (threeRef.current) {
      // Reset selection
      resetHighlight()
      interactionRef.current.isFocused = false
    }
  }, [selectedKeyword])

  // 💫 Highlight keyword connections
  const highlightConnections = useCallback((keywordName: string) => {
    if (!threeRef.current) return
    
    const { nodes } = threeRef.current
    
    // Reset all nodes
    Object.values(nodes).forEach((node: any) => {
      node.mesh.material.color.setStyle(node.originalColor)
      node.mesh.material.opacity = 0.8
    })
    
    // Highlight selected node
    const selectedNode = nodes[keywordName]
    if (selectedNode) {
      selectedNode.mesh.material.color.setHex(0xFFFFFF)
      selectedNode.mesh.material.opacity = 1.0
      
      // Highlight connected nodes
      const connections = keywordData[keywordName] || []
      connections.forEach(connectedName => {
        const connectedNode = nodes[connectedName]
        if (connectedNode) {
          connectedNode.mesh.material.color.setHex(0xFFFF00)
          connectedNode.mesh.material.opacity = 1.0
        }
      })
      
      console.log(`💫 Highlighted ${connections.length} connections for "${keywordName}"`)
    }
  }, [keywordData])

  // 🔄 Reset highlight
  const resetHighlight = useCallback(() => {
    if (!threeRef.current) return
    
    const { nodes } = threeRef.current
    Object.values(nodes).forEach((node: any) => {
      node.mesh.material.color.setStyle(node.originalColor)
      node.mesh.material.opacity = 0.8
    })
  }, [])

  // 🚀 Initialize everything
  useEffect(() => {
    loadKeywordData()
    
    // 강제 타임아웃: 10초 후 무조건 로딩 완료 처리
    const forceTimeout = setTimeout(() => {
      console.warn('⚠️ OptimizedKeywordGlobe 강제 타임아웃 (10초)')
      setIsLoading(false)
      setThreeJSReady(false)
    }, 10000)
    
    return () => clearTimeout(forceTimeout)
  }, [loadKeywordData])

  useEffect(() => {
    if (threeJSReady) {
      initializeThreeJS()
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (threeRef.current) {
        const { renderer, labelRenderer } = threeRef.current
        if (containerRef.current) {
          containerRef.current.removeChild(renderer.domElement)
          containerRef.current.removeChild(labelRenderer.domElement)
        }
        renderer.dispose()
      }
    }
  }, [threeJSReady, initializeThreeJS])

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700 mb-2 font-medium">
              {!threeJSReady ? '3D 엔진 로딩 중...' : '키워드 매트릭스 생성 중...'}
            </p>
            <div className="w-48 bg-gray-200 rounded-full h-2 mx-auto mb-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">
              {loadProgress < 30 ? 'Three.js 라이브러리 로딩...' :
               loadProgress < 50 ? '3D 엔진 초기화...' :
               loadProgress < 80 ? '키워드 데이터 로딩...' :
               '시각화 생성 중...'}
            </p>
          </div>
        </div>
      )}
      
      {!isLoading && (
        <div className="absolute bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>최적화 모드 활성</span>
          </div>
          <div>LOD: {performanceSettings.enableLOD ? 'ON' : 'OFF'} | Culling: {performanceSettings.enableFrustumCulling ? 'ON' : 'OFF'}</div>
        </div>
      )}
    </div>
  )
}
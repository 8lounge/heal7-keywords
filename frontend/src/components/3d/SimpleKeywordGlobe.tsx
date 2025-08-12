'use client'

import React, { useEffect, useRef, useState } from 'react'
import { keywordApi, type KeywordData } from '@/lib/keywordApi'

interface SimpleKeywordGlobeProps {
  keywords?: KeywordData[]
  onKeywordClick?: (keyword: KeywordData) => void
  selectedKeyword?: KeywordData | null
  isAnimating?: boolean
}

export default function SimpleKeywordGlobe({
  keywords = [],
  onKeywordClick,
  selectedKeyword,
  isAnimating = false
}: SimpleKeywordGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keywordData, setKeywordData] = useState<KeywordData[]>([])

  useEffect(() => {
    const loadKeywords = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        if (keywords.length > 0) {
          setKeywordData(keywords)
        } else {
          // Load from API
          const matrix = await keywordApi.getKeywordMatrix()
          setKeywordData(matrix.keywords)
        }
        
        // 즉시 로딩 완료 - 불필요한 대기 시간 제거
        setIsLoading(false)
        
      } catch (err) {
        console.error('키워드 로딩 실패:', err)
        setError('키워드 데이터를 불러올 수 없습니다.')
        setIsLoading(false)
      }
    }

    loadKeywords()
  }, [keywords])

  // 카테고리별 색상 매핑
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'A': '#3B82F6', // Blue
      'B': '#EC4899', // Pink  
      'C': '#F59E0B'  // Orange
    }
    return colors[category] || '#6B7280'
  }

  // Golden Spiral 위치 계산 (개선된 분포)
  const generatePositions = (count: number) => {
    const positions: Array<{ x: number; y: number; z: number }> = []
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    const radius = Math.min(150, window.innerWidth * 0.2) // 반응형 반지름
    
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const radiusAtY = Math.sqrt(1 - y * y)
      const theta = goldenAngle * i
      
      const x = Math.cos(theta) * radiusAtY
      const z = Math.sin(theta) * radiusAtY
      
      // 약간의 랜덤성 추가로 더 자연스러운 배치
      const randomOffset = 0.1
      positions.push({
        x: x * radius + (Math.random() - 0.5) * randomOffset * radius,
        y: y * radius + (Math.random() - 0.5) * randomOffset * radius, 
        z: z * radius + (Math.random() - 0.5) * randomOffset * radius
      })
    }
    
    return positions
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white mb-2">CSS 3D 시각화 초기화 중...</p>
          <p className="text-sm text-gray-300">키워드 {keywords.length}개 준비 중</p>
          <p className="text-xs text-gray-400 mt-2">SimpleKeywordGlobe 로딩 중</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 to-red-800 rounded-lg">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">⚠</span>
          </div>
          <p className="text-white mb-2">로딩 실패</p>
          <p className="text-sm text-red-200">{error}</p>
        </div>
      </div>
    )
  }

  const positions = generatePositions(keywordData.length)

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    >
      {/* CSS-based 3D Simulation */}
      <div className="absolute inset-0 perspective-1000">
        <div 
          className="relative w-full h-full transform-style-preserve-3d animate-spin-slow"
          style={{
            transformStyle: 'preserve-3d',
            animation: isAnimating ? 'rotate3d 5s linear infinite' : 'rotate3d 30s linear infinite'
          }}
        >
          {keywordData.map((keyword, index) => {
            const position = positions[index]
            const isSelected = selectedKeyword?.id === keyword.id
            const scale = isSelected ? 1.5 : 1
            
            return (
              <div
                key={keyword.id}
                className={`absolute cursor-pointer transition-all duration-300 hover:scale-125 ${
                  isSelected ? 'z-50' : 'z-10'
                }`}
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `
                    translate(-50%, -50%) 
                    translate3d(${position.x}px, ${position.y}px, ${position.z}px)
                    scale(${scale})
                  `,
                  transformStyle: 'preserve-3d'
                }}
                onClick={() => onKeywordClick?.(keyword)}
              >
                {/* Keyword Sphere */}
                <div 
                  className={`w-4 h-4 rounded-full shadow-lg transition-all duration-300 ${
                    isSelected ? 'animate-pulse' : ''
                  }`}
                  style={{ 
                    backgroundColor: getCategoryColor(keyword.category),
                    boxShadow: `0 0 ${isSelected ? '30px' : '15px'} ${getCategoryColor(keyword.category)}${isSelected ? 'FF' : '80'}`,
                    filter: isSelected ? 'brightness(1.3)' : 'brightness(1)'
                  }}
                />
                
                {/* Keyword Label */}
                <div 
                  className={`absolute top-6 left-1/2 transform -translate-x-1/2 bg-black/90 
                           text-white text-xs px-2 py-1 rounded whitespace-nowrap backdrop-blur-sm
                           transition-all duration-300 ${
                             isSelected ? 'opacity-100 scale-110' : 'opacity-0 hover:opacity-100'
                           }`}
                  style={{ 
                    transform: 'translateX(-50%) rotateX(0deg)',
                    backfaceVisibility: 'hidden'
                  }}
                >
                  {keyword.name}
                  <div className="text-xs text-gray-300">
                    {keyword.category}-{keyword.subcategory} | {keyword.connections}연결
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Info Overlay */}
      <div className="absolute bottom-4 left-4 bg-black/80 text-white p-3 rounded-lg text-xs backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>CSS 3D 시뮬레이션</span>
        </div>
        <div>{keywordData.length}개 키워드 로딩 완료</div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs backdrop-blur-sm">
        <div>🖱️ 키워드 클릭: 상세 정보</div>
        <div>🎯 자동 회전 중</div>
      </div>
      
      <style jsx>{`
        @keyframes rotate3d {
          0% { transform: rotateY(0deg) rotateX(10deg); }
          100% { transform: rotateY(360deg) rotateX(10deg); }
        }
        
        .perspective-1000 {
          perspective: 1000px;
        }
        
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        
        .animate-spin-slow {
          animation: rotate3d 20s linear infinite;
        }
      `}</style>
    </div>
  )
}
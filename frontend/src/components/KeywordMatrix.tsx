'use client'

import React, { useState, useEffect } from 'react'
import { 
  Sparkles,
  Search,
  RefreshCw,
  Activity,
  Network,
  Gauge
} from 'lucide-react'
import { generateKeywordNodes, searchKeywords, filterKeywordsByCategory } from '@/utils/keywordGlobeData'

export default function KeywordMatrix() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [keywords, setKeywords] = useState<any[]>([])
  const [filteredKeywords, setFilteredKeywords] = useState<any[]>([])
  const [matrixStats, setMatrixStats] = useState({
    total_keywords: 442,
    active_keywords: 442,
    total_connections: 1247,
    network_density: 0.85
  })

  // 키워드 데이터 초기화
  useEffect(() => {
    const initializeKeywords = async () => {
      setIsLoading(true)
      console.log('🔄 키워드 매트릭스 데이터 초기화 시작')
      
      try {
        // 키워드 데이터 생성 (442개)
        const keywordNodes = generateKeywordNodes()
        setKeywords(keywordNodes)
        setFilteredKeywords(keywordNodes)
        
        console.log('✅ 키워드 매트릭스 초기화 완료:', keywordNodes.length, '개 키워드')
        
        setTimeout(() => {
          setIsLoading(false)
        }, 1000)
        
      } catch (error) {
        console.error('❌ 키워드 매트릭스 초기화 실패:', error)
        setIsLoading(false)
      }
    }

    initializeKeywords()
  }, [])

  // 검색 및 필터링
  useEffect(() => {
    let filtered = keywords

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      filtered = filterKeywordsByCategory(filtered, selectedCategory)
    }

    // 검색어 필터
    if (searchTerm.trim()) {
      filtered = searchKeywords(filtered, searchTerm)
    }

    setFilteredKeywords(filtered)
  }, [searchTerm, selectedCategory, keywords])

  // 3D 매트릭스 렌더링 (간단한 CSS 3D 버전)
  const render3DMatrix = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-white">키워드 매트릭스 로딩 중...</p>
          </div>
        </div>
      )
    }

    return (
      <div className="keyword-3d-canvas bg-white/10 backdrop-blur-sm rounded-lg p-8 h-96">
        <div className="grid grid-cols-6 gap-2 h-full overflow-hidden">
          {filteredKeywords.slice(0, 72).map((keyword, index) => (
            <div
              key={keyword.id}
              className="bg-white/20 backdrop-blur-sm rounded-md p-2 text-xs text-white text-center hover:bg-white/30 transition-all duration-300 transform hover:scale-105"
              style={{
                backgroundColor: keyword.color + '40',
                animationDelay: `${index * 50}ms`
              }}
            >
              <div className="font-medium truncate">{keyword.name}</div>
              <div className="text-xs opacity-70">{keyword.category}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 컨트롤 */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* 검색 */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
            <input
              type="text"
              placeholder="키워드 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/20 border border-white/30 rounded-md py-2 pl-10 pr-4 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 카테고리 필터 */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white/20 border border-white/30 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체 카테고리</option>
            <option value="A">A그룹 (심리학적)</option>
            <option value="B">B그룹 (신경과학적)</option>
            <option value="C">C그룹 (개선영역)</option>
          </select>

          {/* 새로고침 버튼 */}
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500/80 hover:bg-blue-600/80 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{matrixStats.total_keywords}</div>
            <div className="text-sm text-white/70">총 키워드</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{filteredKeywords.length}</div>
            <div className="text-sm text-white/70">표시 중</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{matrixStats.total_connections}</div>
            <div className="text-sm text-white/70">연결 수</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{Math.round(matrixStats.network_density * 100)}%</div>
            <div className="text-sm text-white/70">네트워크 밀도</div>
          </div>
        </div>
      </div>

      {/* 3D 매트릭스 */}
      {render3DMatrix()}

      {/* 카테고리 범례 */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">카테고리 범례</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <h4 className="font-medium text-white mb-2">A그룹 (심리학적)</h4>
            <div className="space-y-1 text-sm text-white/80">
              <div>A-1: 인지차원 (44개)</div>
              <div>A-2: 개방성차원 (29개)</div>
              <div>A-3: 에너지차원 (27개)</div>
              <div>A-4: 관계차원 (45개)</div>
              <div>A-5: 정서차원 (31개)</div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">B그룹 (신경과학적)</h4>
            <div className="space-y-1 text-sm text-white/80">
              <div>B-1: 전전두엽계 (11개)</div>
              <div>B-2: 측두두정계 (14개)</div>
              <div>B-3: 변연계 (44개)</div>
              <div>B-4: 기저핵계 (13개)</div>
              <div>B-5: 뇌간계 (22개)</div>
              <div>B-6: 신경화학계 (23개)</div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">C그룹 (개선영역)</h4>
            <div className="space-y-1 text-sm text-white/80">
              <div>C-1: 불안스트레스 (19개)</div>
              <div>C-2: 우울무기력 (16개)</div>
              <div>C-3: 분노공격성 (15개)</div>
              <div>C-4: 중독의존 (9개)</div>
              <div>C-5: 사회부적응 (14개)</div>
              <div>C-6: 강박완벽주의 (12개)</div>
              <div>C-7: 자기파괴 (9개)</div>
              <div>C-8: 인지왜곡 (22개)</div>
              <div>C-9: 성격장애 (23개)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
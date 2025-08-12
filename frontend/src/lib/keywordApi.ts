// HEAL7 키워드 API 서비스
// 실제 데이터베이스 연동을 위한 API 클라이언트

interface KeywordData {
  id: number
  name: string
  category: string
  subcategory: string
  weight: number
  connections: number
  status: string
  dependencies: number[]
  position?: [number, number, number]
  color?: string
}

interface KeywordCreateData {
  name: string
  subcategory: string
  weight?: number
  is_active?: boolean
}

interface KeywordUpdateData {
  name?: string
  subcategory?: string
  weight?: number
  is_active?: boolean
}

interface KeywordMatrix {
  total_keywords: number
  active_keywords: number
  total_connections: number
  network_density: number
  keywords: KeywordData[]
  last_updated: string
}

interface KeywordStats {
  total_keywords: number
  active_keywords: number
  total_dependencies: number
  category_distribution: Record<string, number>
  cache_status: string
}

class KeywordApiService {
  private baseUrl: string
  private timeout: number

  constructor() {
    // 환경별 API URL 설정
    if (typeof window !== 'undefined') {
      // 브라우저 환경: 현재 도메인 사용 (Nginx 프록시 경유)
      this.baseUrl = `${window.location.protocol}//${window.location.host}`
    } else {
      // 서버 환경 (SSR): localhost 사용
      this.baseUrl = 'http://localhost:8001'
    }
    this.timeout = 10000 // 10초 타임아웃
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * 키워드 목록 조회 (442개 전체)
   */
  async getKeywords(params?: {
    category?: string
    search?: string
    limit?: number
  }): Promise<KeywordData[]> {
    try {
      // 442개 키워드 전체 조회 API 사용
      const url = `${this.baseUrl}/admin-api/keywords/all`
      const response = await this.fetchWithTimeout(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const keywords: KeywordData[] = data.map((keyword: any) => ({
        id: keyword.id,
        name: keyword.keyword,  // API에서 'keyword' 필드 사용
        category: keyword.subcategory_name.split('-')[0], // A-1 -> A
        subcategory: keyword.subcategory_name,  // API에서 'subcategory_name' 필드 사용
        weight: keyword.weight || Math.random() * 10, // 가중치가 없으면 랜덤값
        connections: keyword.dependencies?.length || Math.floor(Math.random() * 15) + 1,
        status: keyword.is_active ? 'active' : 'inactive',
        dependencies: keyword.dependencies || [],
        position: this.generatePosition(keyword),
        color: this.getCategoryColor(keyword.subcategory_name)
      }))
      
      // 클라이언트 사이드 필터링 적용
      let filteredKeywords = keywords
      
      if (params?.category && params.category !== 'all') {
        filteredKeywords = filteredKeywords.filter(k => k.category === params.category)
      }
      
      if (params?.search) {
        const searchTerm = params.search.toLowerCase()
        filteredKeywords = filteredKeywords.filter(k => 
          k.name.toLowerCase().includes(searchTerm) ||
          k.subcategory.toLowerCase().includes(searchTerm)
        )
      }
      
      if (params?.limit) {
        filteredKeywords = filteredKeywords.slice(0, params.limit)
      }
      
      return filteredKeywords
    } catch (error) {
      console.error('키워드 목록 조회 실패:', error)
      // 폴백으로 시뮬레이션 데이터 반환
      return this.generateFallbackKeywords()
    }
  }

  /**
   * 키워드 매트릭스 데이터 조회 (3D 시각화용)
   */
  async getKeywordMatrix(): Promise<KeywordMatrix> {
    try {
      // 통계와 전체 키워드 데이터를 병렬로 가져오기
      const [statsResponse, keywordsResponse] = await Promise.all([
        this.fetchWithTimeout(`${this.baseUrl}/admin-api/keywords/stats`),
        this.fetchWithTimeout(`${this.baseUrl}/admin-api/keywords/all`)
      ])

      if (!statsResponse.ok || !keywordsResponse.ok) {
        throw new Error('키워드 매트릭스 데이터 조회 실패')
      }

      const stats = await statsResponse.json()
      const keywordsData = await keywordsResponse.json()

      // KeywordData 포맷으로 변환
      const keywords: KeywordData[] = keywordsData.map((keyword: any) => ({
        id: keyword.id,
        name: keyword.keyword,
        category: keyword.subcategory_name.split('-')[0], // A-1 -> A
        subcategory: keyword.subcategory_name,
        weight: keyword.weight || Math.random() * 10,
        connections: keyword.dependencies?.length || Math.floor(Math.random() * 15) + 1,
        status: keyword.is_active ? 'active' : 'inactive',
        dependencies: keyword.dependencies || [],
        position: this.generatePosition(keyword),
        color: this.getCategoryColor(keyword.subcategory_name)
      }))

      return {
        total_keywords: stats.total_keywords,
        active_keywords: stats.active_keywords,
        total_connections: stats.total_dependencies,
        network_density: this.calculateNetworkDensity(keywords),
        keywords,
        last_updated: keywordsData.last_updated || new Date().toISOString()
      }
    } catch (error) {
      console.error('키워드 매트릭스 조회 실패:', error)
      // 폴백으로 시뮬레이션 데이터 반환
      return this.generateFallbackMatrix()
    }
  }

  /**
   * 키워드 의존성 네트워크 조회
   */
  async getKeywordDependencies(keywordId: number): Promise<{
    keyword_id: number
    dependencies: Array<{
      id: number
      name: string
      strength: number
      weight: number
      type: string
      direction: string
    }>
  }> {
    try {
      const url = `${this.baseUrl}/admin-api/keywords/dependencies/${keywordId}`
      const response = await this.fetchWithTimeout(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('키워드 의존성 조회 실패:', error)
      return {
        keyword_id: keywordId,
        dependencies: []
      }
    }
  }

  /**
   * API 헬스체크
   */
  async healthCheck(): Promise<{
    service: string
    status: string
    database: string
    redis: string
    timestamp: string
  }> {
    try {
      const url = `${this.baseUrl}/admin-api/keywords/health`
      const response = await this.fetchWithTimeout(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('헬스체크 실패:', error)
      return {
        service: 'keywords_api_fallback',
        status: 'degraded',
        database: 'disconnected',
        redis: 'disconnected',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * 폴백 키워드 데이터 생성 (API 실패 시)
   */
  private generateFallbackKeywords(): KeywordData[] {
    const sampleKeywords = [
      { name: '창의성', category: 'A', subcategory: 'A-1' },
      { name: '논리적사고', category: 'A', subcategory: 'A-1' },
      { name: '집중력', category: 'A', subcategory: 'A-1' },
      { name: '감정조절', category: 'B', subcategory: 'B-3' },
      { name: '스트레스관리', category: 'C', subcategory: 'C-1' },
    ]

    return sampleKeywords.map((kw, index) => ({
      id: index + 1,
      name: kw.name,
      category: kw.category,
      subcategory: kw.subcategory,
      weight: Math.random() * 8 + 2,
      connections: Math.floor(Math.random() * 20) + 5,
      status: 'active',
      dependencies: [],
      position: [
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      ] as [number, number, number],
      color: this.getCategoryColor(kw.subcategory)
    }))
  }

  /**
   * 폴백 매트릭스 데이터 생성
   */
  private generateFallbackMatrix(): KeywordMatrix {
    const keywords = this.generateFallbackKeywords()
    
    return {
      total_keywords: keywords.length,
      active_keywords: keywords.length,
      total_connections: keywords.reduce((sum, k) => sum + k.connections, 0),
      network_density: 45.2,
      keywords,
      last_updated: new Date().toISOString()
    }
  }

  /**
   * 키워드 생성
   */
  async createKeyword(keywordData: KeywordCreateData): Promise<KeywordData> {
    try {
      const url = `${this.baseUrl}/admin-api/keywords/`
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        body: JSON.stringify(keywordData)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('키워드 생성 실패:', error)
      throw error
    }
  }

  /**
   * 키워드 수정
   */
  async updateKeyword(keywordId: number, keywordData: KeywordUpdateData): Promise<KeywordData> {
    try {
      const url = `${this.baseUrl}/admin-api/keywords/${keywordId}`
      const response = await this.fetchWithTimeout(url, {
        method: 'PUT',
        body: JSON.stringify(keywordData)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('키워드 수정 실패:', error)
      throw error
    }
  }

  /**
   * 키워드 삭제
   */
  async deleteKeyword(keywordId: number): Promise<{ message: string }> {
    try {
      const url = `${this.baseUrl}/admin-api/keywords/${keywordId}`
      const response = await this.fetchWithTimeout(url, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('키워드 삭제 실패:', error)
      throw error
    }
  }

  /**
   * 특정 키워드 조회
   */
  async getKeyword(keywordId: number): Promise<KeywordData> {
    try {
      const url = `${this.baseUrl}/admin-api/keywords/${keywordId}`
      const response = await this.fetchWithTimeout(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('키워드 조회 실패:', error)
      throw error
    }
  }

  /**
   * 서브카테고리 목록 조회
   */
  async getSubcategories(): Promise<Array<{code: string, name: string, group: string}>> {
    // 하드코딩된 서브카테고리 목록 (실제로는 별도 API 엔드포인트를 만들 수 있음)
    return [
      // A그룹 (심리학적)
      { code: 'A-1', name: '인지차원', group: 'A' },
      { code: 'A-2', name: '개방성차원', group: 'A' },
      { code: 'A-3', name: '에너지차원', group: 'A' },
      { code: 'A-4', name: '관계차원', group: 'A' },
      { code: 'A-5', name: '정서차원', group: 'A' },
      // B그룹 (신경과학적)
      { code: 'B-1', name: '전전두엽계', group: 'B' },
      { code: 'B-2', name: '측두두정계', group: 'B' },
      { code: 'B-3', name: '변경계', group: 'B' },
      { code: 'B-4', name: '기저핵계', group: 'B' },
      { code: 'B-5', name: '뇌간계', group: 'B' },
      { code: 'B-6', name: '신경화학계', group: 'B' },
      // C그룹 (개선영역)
      { code: 'C-1', name: '불안스트레스', group: 'C' },
      { code: 'C-2', name: '우울무기력', group: 'C' },
      { code: 'C-3', name: '분노공격성', group: 'C' },
      { code: 'C-4', name: '중독의존', group: 'C' },
      { code: 'C-5', name: '사회부적응', group: 'C' },
      { code: 'C-6', name: '강박완벽주의', group: 'C' },
      { code: 'C-7', name: '자기파괴', group: 'C' },
      { code: 'C-8', name: '인지왜곡', group: 'C' },
      { code: 'C-9', name: '성격장애', group: 'C' }
    ]
  }

  /**
   * 키워드 검색 API
   */
  async searchKeywords(query: string): Promise<KeywordData[]> {
    try {
      const url = `${this.baseUrl}/admin-api/keywords/search`
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data.keywords.map((keyword: any) => ({
        id: keyword.id,
        name: keyword.keyword,
        category: keyword.subcategory_name.split('-')[0],
        subcategory: keyword.subcategory_name,
        weight: keyword.weight || Math.random() * 10,
        connections: keyword.dependencies?.length || Math.floor(Math.random() * 15) + 1,
        status: keyword.is_active ? 'active' : 'inactive',
        dependencies: keyword.dependencies || [],
        position: this.generatePosition(keyword),
        color: this.getCategoryColor(keyword.subcategory_name)
      }))
    } catch (error) {
      console.error('키워드 검색 실패:', error)
      return []
    }
  }

  /**
   * 키워드 통계 조회
   */
  async getKeywordStats(): Promise<KeywordStats> {
    try {
      const url = `${this.baseUrl}/admin-api/keywords/stats`
      const response = await this.fetchWithTimeout(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('키워드 통계 조회 실패:', error)
      return {
        total_keywords: 0,
        active_keywords: 0,
        total_dependencies: 0,
        category_distribution: {},
        cache_status: 'error'
      }
    }
  }

  /**
   * 3D 시각화용 키워드 위치 생성
   */
  private generatePosition(keyword: any): [number, number, number] {
    // 서브카테고리별 구역 할당
    const subcategory = keyword.subcategory_name || keyword.subcategory
    const group = subcategory.split('-')[0]
    const subIndex = parseInt(subcategory.split('-')[1]) - 1
    
    // 그룹별 기본 위치
    let baseX = 0, baseY = 0, baseZ = 0
    
    switch (group) {
      case 'A': // 심리학적 - 좌측
        baseX = -2
        baseY = (subIndex - 2) * 0.8
        break
      case 'B': // 신경과학적 - 중앙
        baseX = 0
        baseY = (subIndex - 2.5) * 0.6
        break
      case 'C': // 개선영역 - 우측
        baseX = 2
        baseY = (subIndex - 4) * 0.5
        break
    }
    
    // 개별 키워드 랜덤 오프셋
    const randomOffset = 0.3
    return [
      baseX + (Math.random() - 0.5) * randomOffset,
      baseY + (Math.random() - 0.5) * randomOffset,
      baseZ + (Math.random() - 0.5) * randomOffset
    ]
  }

  /**
   * 네트워크 밀도 계산
   */
  private calculateNetworkDensity(keywords: KeywordData[]): number {
    const totalNodes = keywords.length
    const totalConnections = keywords.reduce((sum, k) => sum + k.connections, 0)
    const maxPossibleConnections = totalNodes * (totalNodes - 1) / 2
    
    return maxPossibleConnections > 0 ? (totalConnections / maxPossibleConnections) * 100 : 0
  }

  /**
   * 20개 서브카테고리별 최적화된 색상 반환
   */
  private getCategoryColor(subcategory: string): string {
    const colors: Record<string, string> = {
      // A그룹 (심리학적) - 파란색 계열
      'A-1': '#3B82F6', // 인지차원 - 파란색
      'A-2': '#06B6D4', // 개방성차원 - 시안
      'A-3': '#10B981', // 에너지차원 - 에메랄드
      'A-4': '#8B5CF6', // 관계차원 - 보라색
      'A-5': '#F59E0B', // 정서차원 - 앰버
      
      // B그룹 (신경과학적) - 따뜻한 색 계열
      'B-1': '#EF4444', // 전전두엽계 - 빨간색
      'B-2': '#EC4899', // 측두두정계 - 핑크
      'B-3': '#6366F1', // 변연계 - 인디고
      'B-4': '#84CC16', // 기저핵계 - 라임
      'B-5': '#F97316', // 뇌간계 - 오렌지
      'B-6': '#14B8A6', // 신경화학계 - 틸
      
      // C그룹 (개선영역) - 깊은 색 계열
      'C-1': '#DC2626', // 불안스트레스 - 진한 빨강
      'C-2': '#7C2D12', // 우울무기력 - 갈색
      'C-3': '#991B1B', // 분노공격성 - 적갈색
      'C-4': '#92400E', // 중독의존 - 황갈색
      'C-5': '#BE123C', // 사회부적응 - 로즈
      'C-6': '#A21CAF', // 강박완벽주의 - 자홍색
      'C-7': '#581C87', // 자기파괴 - 진한 보라
      'C-8': '#1E1B4B', // 인지왜곡 - 네이비
      'C-9': '#450A0A'  // 성격장애 - 진한 적갈색
    }
    
    return colors[subcategory] || '#888888'
  }

  /**
   * 서브카테고리별 상세 정보 반환
   */
  getSubcategoryInfo(subcategory: string): {
    code: string, 
    name: string, 
    group: string, 
    color: string,
    description: string
  } {
    const subcategoryMap: Record<string, {name: string, group: string, description: string}> = {
      // A그룹 (심리학적)
      'A-1': { name: '인지차원', group: 'A', description: '사고력, 창의성, 문제해결' },
      'A-2': { name: '개방성차원', group: 'A', description: '호기심, 상상력, 예술성' },
      'A-3': { name: '에너지차원', group: 'A', description: '활력, 외향성, 적극성' },
      'A-4': { name: '관계차원', group: 'A', description: '사회성, 공감, 소통' },
      'A-5': { name: '정서차원', group: 'A', description: '감정조절, 안정성, 성숙도' },
      
      // B그룹 (신경과학적)
      'B-1': { name: '전전두엽계', group: 'B', description: '실행기능, 계획, 의사결정' },
      'B-2': { name: '측두두정계', group: 'B', description: '언어, 공간인지, 기억' },
      'B-3': { name: '변연계', group: 'B', description: '감정, 동기, 스트레스 반응' },
      'B-4': { name: '기저핵계', group: 'B', description: '운동제어, 습관, 보상' },
      'B-5': { name: '뇌간계', group: 'B', description: '각성, 주의, 생체리듬' },
      'B-6': { name: '신경화학계', group: 'B', description: '신경전달물질, 호르몬' },
      
      // C그룹 (개선영역)
      'C-1': { name: '불안스트레스', group: 'C', description: '불안장애, 스트레스 관리' },
      'C-2': { name: '우울무기력', group: 'C', description: '우울증, 의욕저하' },
      'C-3': { name: '분노공격성', group: 'C', description: '분노조절, 공격성 관리' },
      'C-4': { name: '중독의존', group: 'C', description: '물질/행위 중독' },
      'C-5': { name: '사회부적응', group: 'C', description: '사회성 부족, 고립' },
      'C-6': { name: '강박완벽주의', group: 'C', description: '강박증, 완벽주의' },
      'C-7': { name: '자기파괴', group: 'C', description: '자해, 자기파괴적 행동' },
      'C-8': { name: '인지왜곡', group: 'C', description: '부정적 사고패턴' },
      'C-9': { name: '성격장애', group: 'C', description: '성격적 특성의 극단화' }
    }

    const info = subcategoryMap[subcategory]
    if (!info) {
      return { 
        code: subcategory, 
        name: '미분류', 
        group: 'X', 
        color: '#888888', 
        description: '분류되지 않은 키워드' 
      }
    }

    return {
      code: subcategory,
      name: info.name,
      group: info.group,
      color: this.getCategoryColor(subcategory),
      description: info.description
    }
  }
}

// 싱글톤 인스턴스 생성
export const keywordApi = new KeywordApiService()

// 타입 내보내기
export type { KeywordData, KeywordMatrix, KeywordStats, KeywordCreateData, KeywordUpdateData }
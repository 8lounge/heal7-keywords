import { Pool, PoolClient } from 'pg'

// PostgreSQL 연결 풀 (키워드 서비스 전용)
class KeywordDatabasePool {
  private static instance: Pool | null = null
  
  public static getInstance(): Pool {
    if (!KeywordDatabasePool.instance) {
      // 키워드 서비스용 PostgreSQL 연결 설정
      const connectionConfigs = [
        // 1. Unix domain socket 연결
        {
          host: '/var/run/postgresql',
          user: 'postgres',
          database: 'livedb',
          max: 5, // 키워드 서비스는 연결 수 제한
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000
        },
        // 2. TCP 연결
        {
          host: 'localhost',
          port: 5432,
          user: 'postgres',
          database: 'livedb', 
          max: 5,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000
        }
      ]

      // 연결 시도
      for (let i = 0; i < connectionConfigs.length; i++) {
        try {
          console.log(`🔄 Keywords PostgreSQL 연결 시도 ${i + 1}`)
          KeywordDatabasePool.instance = new Pool(connectionConfigs[i])
          
          KeywordDatabasePool.instance.on('error', (err) => {
            console.error(`❌ Keywords PostgreSQL 연결 풀 오류:`, err)
          })
          
          KeywordDatabasePool.instance.on('connect', () => {
            console.log(`✅ Keywords PostgreSQL 연결 성공`)
          })
          
          break
        } catch (error) {
          console.warn(`⚠️ Keywords PostgreSQL 연결 설정 ${i + 1} 실패:`, error)
          KeywordDatabasePool.instance = null
          continue
        }
      }

      if (!KeywordDatabasePool.instance) {
        console.warn('⚠️ Keywords PostgreSQL 모든 연결 설정 실패 - 기본 설정 사용')
        KeywordDatabasePool.instance = new Pool({
          host: 'localhost',
          port: 5432,
          user: 'postgres',
          database: 'livedb',
          max: 3,
          idleTimeoutMillis: 5000,
          connectionTimeoutMillis: 3000
        })
      }
    }
    
    return KeywordDatabasePool.instance
  }
}

// 키워드 데이터베이스 쿼리 실행 함수
export async function executeKeywordQuery<T = any>(
  text: string, 
  params: any[] = []
): Promise<T[]> {
  const pool = KeywordDatabasePool.getInstance()
  const client: PoolClient = await pool.connect()
  
  try {
    console.log('🔍 Keywords SQL 쿼리 실행:', text.substring(0, 50) + '...')
    const start = Date.now()
    const result = await client.query(text, params)
    const duration = Date.now() - start
    console.log(`✅ Keywords 쿼리 완료 (${duration}ms, ${result.rows.length}개 결과)`)
    
    return result.rows as T[]
  } catch (error) {
    console.error('❌ Keywords SQL 쿼리 실행 오류:', error)
    throw error
  } finally {
    client.release()
  }
}

// 키워드 데이터베이스 연결 테스트
export async function testKeywordDatabaseConnection(): Promise<boolean> {
  try {
    const result = await executeKeywordQuery('SELECT NOW() as current_time')
    console.log('✅ Keywords 데이터베이스 연결 테스트 성공:', result[0])
    return true
  } catch (error) {
    console.error('❌ Keywords 데이터베이스 연결 테스트 실패:', error)
    return false
  }
}

// 키워드 관련 타입 정의
export interface KeywordRow {
  id: number
  text: string
  subcategory_id: number
  is_active: boolean
  created_at: string
  updated_at: string
  category_name?: string
  subcategory_name?: string
  weight?: number
  usage_count?: number
}

export interface KeywordMatrixData {
  total_keywords: number
  active_keywords: number
  total_connections: number
  network_density: number
  categories: Record<string, { name: string; count: number }>
  last_updated: string
  data_source: string
}

export const keywordPool = KeywordDatabasePool.getInstance()
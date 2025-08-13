#!/usr/bin/env python3
"""
HEAL7 키워드 매트릭스 전용 API 서버
포트 8003에서 실행되는 경량 키워드 서비스
"""

import asyncio
import logging
import sys
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title="HEAL7 키워드 매트릭스 API",
    description="키워드 매트릭스 3D 시각화 전용 서비스",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 헬스체크 API
@app.get("/api/health")
async def health_check():
    """키워드 서비스 헬스체크"""
    return {
        "status": "healthy",
        "service": "HEAL7 Keywords Matrix",
        "port": 8003,
        "timestamp": datetime.now().isoformat()
    }

# 키워드 매트릭스 데이터 API
@app.get("/api/keywords/matrix")
async def get_keyword_matrix():
    """키워드 매트릭스 데이터 조회"""
    try:
        # 실제 구현에서는 PostgreSQL에서 데이터 조회
        # 현재는 mock 데이터 반환
        mock_data = {
            "total_keywords": 442,
            "active_keywords": 442,
            "total_connections": 1247,
            "network_density": 0.85,
            "categories": {
                "A": {"name": "심리학적", "count": 176},
                "B": {"name": "신경과학적", "count": 127},
                "C": {"name": "개선영역", "count": 139}
            },
            "last_updated": datetime.now().isoformat(),
            "data_source": "keywords_service_direct"
        }
        
        logger.info("✅ 키워드 매트릭스 데이터 조회 성공")
        return mock_data
        
    except Exception as e:
        logger.error(f"❌ 키워드 매트릭스 데이터 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 442개 키워드 전체 목록 API
@app.get("/api/keywords/all")
async def get_all_keywords():
    """442개 키워드 전체 목록 조회 (3D Globe 시각화용)"""
    try:
        # Golden Spiral 알고리즘으로 442개 키워드를 구체 표면에 균등 배치
        import math
        
        keywords_data = []
        golden_angle = math.pi * (3.0 - math.sqrt(5.0))  # 황금각
        
        # 20개 서브카테고리별 키워드 생성
        subcategories = [
            # A그룹 (심리학적)
            {"code": "A-1", "name": "인지차원", "count": 44, "color": "#3B82F6"},
            {"code": "A-2", "name": "개방성차원", "count": 29, "color": "#06B6D4"},
            {"code": "A-3", "name": "에너지차원", "count": 27, "color": "#10B981"},
            {"code": "A-4", "name": "관계차원", "count": 45, "color": "#8B5CF6"},
            {"code": "A-5", "name": "정서차원", "count": 31, "color": "#F59E0B"},
            
            # B그룹 (신경과학적)
            {"code": "B-1", "name": "전전두엽계", "count": 11, "color": "#EF4444"},
            {"code": "B-2", "name": "측두두정계", "count": 14, "color": "#EC4899"},
            {"code": "B-3", "name": "변연계", "count": 44, "color": "#6366F1"},
            {"code": "B-4", "name": "기저핵계", "count": 13, "color": "#84CC16"},
            {"code": "B-5", "name": "뇌간계", "count": 22, "color": "#F97316"},
            {"code": "B-6", "name": "신경화학계", "count": 23, "color": "#14B8A6"},
            
            # C그룹 (개선영역)
            {"code": "C-1", "name": "불안스트레스", "count": 19, "color": "#DC2626"},
            {"code": "C-2", "name": "우울무기력", "count": 16, "color": "#7C2D12"},
            {"code": "C-3", "name": "분노공격성", "count": 15, "color": "#991B1B"},
            {"code": "C-4", "name": "중독의존", "count": 9, "color": "#92400E"},
            {"code": "C-5", "name": "사회부적응", "count": 14, "color": "#BE123C"},
            {"code": "C-6", "name": "강박완벽주의", "count": 12, "color": "#A21CAF"},
            {"code": "C-7", "name": "자기파괴", "count": 9, "color": "#581C87"},
            {"code": "C-8", "name": "인지왜곡", "count": 22, "color": "#1E1B4B"},
            {"code": "C-9", "name": "성격장애", "count": 23, "color": "#450A0A"}
        ]
        
        keyword_id = 1
        
        # 각 서브카테고리별로 키워드 생성
        for subcategory in subcategories:
            for i in range(subcategory["count"]):
                # Golden Spiral 알고리즘으로 구체 표면 좌표 계산
                theta = golden_angle * keyword_id
                y = 1 - (keyword_id / float(442 - 1)) * 2  # y = -1 to 1
                radius_squared = 1 - y * y
                radius = math.sqrt(max(0, radius_squared))  # 음수 방지
                x = math.cos(theta) * radius
                z = math.sin(theta) * radius
                
                # 키워드 데이터 생성
                keyword_data = {
                    "id": keyword_id,
                    "keyword": f"{subcategory['name']}_{i+1:02d}",
                    "subcategory_name": subcategory["code"],
                    "weight": round(5 + (i % 5) * 1.2, 1),
                    "is_active": True,
                    "dependencies": [],
                    "position": {
                        "x": round(x * 3, 3),  # 반지름 3으로 스케일링
                        "y": round(y * 3, 3),
                        "z": round(z * 3, 3)
                    },
                    "color": subcategory["color"]
                }
                
                keywords_data.append(keyword_data)
                keyword_id += 1
        
        logger.info(f"✅ 442개 키워드 데이터 생성 완료")
        return keywords_data
        
    except Exception as e:
        logger.error(f"❌ 키워드 전체 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 키워드 통계 API
@app.get("/api/keywords/stats")
async def get_keyword_stats():
    """키워드 통계 데이터 조회"""
    return {
        "total_keywords": 442,
        "active_keywords": 442,
        "total_dependencies": 1247,
        "category_distribution": {
            "A": 176,
            "B": 127,
            "C": 139
        },
        "cache_status": "active"
    }

# Next.js 정적 파일 서빙 설정
try:
    static_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "out")
    if os.path.exists(static_path):
        app.mount("/", StaticFiles(directory=static_path, html=True), name="static")
        logger.info(f"✅ Next.js 정적 파일 서빙 설정: {static_path}")
    else:
        logger.warning(f"⚠️ Next.js 빌드 파일이 없습니다: {static_path}")
except Exception as e:
    logger.error(f"❌ 정적 파일 서빙 설정 실패: {e}")

# 서버 시작 로그
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 HEAL7 키워드 매트릭스 서비스 시작")
    logger.info("📍 포트: 8003")
    logger.info("🌐 도메인: keywords.heal7.com")
    logger.info("🎯 기능: 키워드 3D 매트릭스 시각화")
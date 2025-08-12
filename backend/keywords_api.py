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
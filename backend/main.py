#!/usr/bin/env python3
"""
HEAL7 Keywords Matrix Service
Port: 8003 (keywords.heal7.com)
키워드 매트릭스 전용 독립 서비스
"""

import sys
import os
import uvicorn
from keywords_api import app

if __name__ == "__main__":
    uvicorn.run(
        "keywords_api:app",
        host="0.0.0.0",
        port=8003,
        reload=False,
        workers=1
    )
'use client'

import React from 'react'
import KeywordMatrix from '../components/KeywordMatrix'

export default function HomePage() {
  return (
    <div className="keyword-matrix-container">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            HEAL7 키워드 매트릭스
          </h1>
          <p className="text-xl text-white/80">
            442개 키워드의 3D 네트워크 시각화
          </p>
        </div>
        
        <KeywordMatrix />
      </div>
    </div>
  )
}
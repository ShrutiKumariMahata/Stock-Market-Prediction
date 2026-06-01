import { useState } from 'react'

const card = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
}

const actualArchitecture = [
    {
        name: 'Input Layer',
        detail: '5 features (OHLCV) · Sequence length: 60 days',
        color: '#2563eb'
    },
    {
        name: 'LSTM Layer 1',
        detail: 'hidden_size=128 · dropout=0.3 · batch_first=True',
        color: '#8b5cf6'
    },
    {
        name: 'LSTM Layer 2',
        detail: 'hidden_size=128 · dropout=0.3',
        color: '#8b5cf6'
    },
    {
        name: 'Multi-Head Attention',
        detail: '8 heads · embed_dim=128 · dropout=0.3',
        color: '#06b6d4'
    },
    {
        name: 'Layer Normalization',
        detail: 'Applied after attention mechanism',
        color: '#a78bfa'
    },
    {
        name: 'Fully Connected 1',
        detail: 'Linear(128→64) · BatchNorm · ReLU · Dropout(0.3)',
        color: '#10b981'
    },
    {
        name: 'Fully Connected 2',
        detail: 'Linear(64→32) · BatchNorm · ReLU · Dropout(0.3)',
        color: '#10b981'
    },
    {
        name: 'Output Layer',
        detail: 'Linear(32→1) · Stock price prediction',
        color: '#f59e0b'
    },
]

const actualFeatures = [
    {
        category: 'Price Features (from yfinance)',
        items: [
            'Open price',
            'High price',
            'Low price',
            'Close price',
            'Volume',
        ]
    },
    {
        category: 'Moving Averages',
        items: [
            'MA-7 (Short-term trend)',
            'MA-21 (Medium-term trend)',
            'MA-50 (Long-term trend)',
        ]
    },
    {
        category: 'Market Metrics',
        items: [
            'Beta (Volatility vs Market)',
            'Volume Ratio (vs 20-day avg)',
            'Support Level 1 & 2',
            'Resistance Level 1 & 2',
        ]
    },
    {
        category: 'Derived Features',
        items: [
            'Daily Returns',
            'Price Position in Range',
            'Volume Trend (Increasing/Decreasing)',
        ]
    }
]

const actualSpecs = [
    { label: 'Architecture', value: 'LSTM + Multi-Head Attention' },
    { label: 'Input Features', value: '5 base + engineered' },
    { label: 'Sequence Length', value: '60 trading days' },
    { label: 'LSTM Hidden Size', value: '128' },
    { label: 'LSTM Layers', value: '2' },
    { label: 'Attention Heads', value: '8' },
    { label: 'Dropout Rate', value: '0.3' },
    { label: 'Optimizer', value: 'AdamW' },
    { label: 'Learning Rate', value: '0.001 (with scheduler)' },
    { label: 'Loss Function', value: 'Huber Loss' },
    { label: 'Batch Size', value: '32' },
    { label: 'Data Split', value: '80% Train / 20% Validation' },
    { label: 'Early Stopping', value: 'Patience = 15 epochs' },
    { label: 'Gradient Clipping', value: 'Max norm = 1.0' },
    { label: 'Device', value: 'CPU (CUDA if available)' },
]

export default function ModelInfo() {
    const [activeTab, setActiveTab] = useState('architecture')

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>

            <div>
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                    Model Architecture
                </h1>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    LSTM with Multi-Head Attention for Stock Price Prediction
                </p>
            </div>

            {/* Only LSTM-Attention Model Box - Removed CNN-LSTM and Transformer */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '12px'
            }}>
                <div style={{
                    ...card,
                    borderLeft: '3px solid #22c55e'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ color: '#1e293b', fontSize: '14px', margin: 0 }}>LSTM-Attention</h3>
                        <span style={{
                            background: '#22c55e20',
                            color: '#22c55e',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '600'
                        }}>
                            Implemented
                        </span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
                        Primary model. LSTM captures temporal dependencies, attention mechanism identifies important time steps.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
                {[
                    { key: 'architecture', label: 'Architecture' },
                    { key: 'features', label: 'Features' },
                    { key: 'specs', label: 'Specifications' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            background: activeTab === tab.key ? '#ffffff' : 'transparent',
                            color: activeTab === tab.key ? '#2563eb' : '#64748b',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: activeTab === tab.key ? '600' : '400',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Architecture View */}
            {activeTab === 'architecture' && (
                <div style={card}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '16px' }}>
                        Layer Architecture (Actual Implementation)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {actualArchitecture.map((layer, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                opacity: 1,
                                transition: 'all 0.2s'
                            }}>
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: layer.color + '20',
                                    color: layer.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    flexShrink: 0
                                }}>
                                    {i + 1}
                                </div>

                                <div style={{
                                    width: '3px',
                                    height: '48px',
                                    background: layer.color,
                                    borderRadius: '2px',
                                    flexShrink: 0
                                }} />

                                <div style={{
                                    flex: 1,
                                    background: '#f8fafc',
                                    border: `1px solid ${layer.color}30`,
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    transition: 'all 0.2s'
                                }}>
                                    <div style={{
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: layer.color,
                                        marginBottom: '4px'
                                    }}>
                                        {layer.name}
                                    </div>
                                    <div style={{
                                        fontSize: '11px',
                                        color: '#64748b',
                                        fontFamily: "'JetBrains Mono', monospace",
                                        lineHeight: '1.5'
                                    }}>
                                        {layer.detail}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '16px', marginTop: '4px' }}>
                            ↓ Predicted Price ↓
                        </div>
                    </div>
                </div>
            )}

            {/* Features View - Removed Technical Indicators */}
            {activeTab === 'features' && (
                <div style={card}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '16px' }}>
                        Input Features
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        {actualFeatures.map((category, i) => (
                            <div key={i} style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '14px'
                            }}>
                                <h4 style={{
                                    color: '#2563eb',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    marginBottom: '10px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {category.category}
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {category.items.map((item, j) => (
                                        <div key={j} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '12px',
                                            color: '#475569'
                                        }}>
                                            <div style={{
                                                width: '5px',
                                                height: '5px',
                                                borderRadius: '50%',
                                                background: '#2563eb',
                                                flexShrink: 0
                                            }} />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#475569',
                        lineHeight: '1.6'
                    }}>
                        <strong style={{ color: '#2563eb' }}>Note:</strong> Features are engineered from raw OHLCV data
                        obtained via Yahoo Finance (yfinance).
                    </div>
                </div>
            )}

            {/* Specifications View */}
            {activeTab === 'specs' && (
                <div style={card}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '14px' }}>
                        Training & Model Specifications
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
                        {actualSpecs.map(({ label, value }) => (
                            <div key={label} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 14px',
                                background: '#f8fafc',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0'
                            }}>
                                <span style={{ color: '#64748b', fontSize: '12px' }}>{label}</span>
                                <span style={{
                                    color: '#1e293b',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '12px',
                                    fontWeight: '600'
                                }}>
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Data Pipeline */}
            <div style={card}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '14px' }}>
                    Data Pipeline
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    fontSize: '12px',
                    color: '#64748b',
                    fontFamily: "'JetBrains Mono', monospace"
                }}>
                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 12px', borderRadius: '6px' }}>
                        Yahoo Finance API
                    </span>
                    <span style={{ color: '#94a3b8' }}>→</span>
                    <span style={{ background: '#f3e8ff', color: '#8b5cf6', padding: '6px 12px', borderRadius: '6px' }}>
                        Data Caching
                    </span>
                    <span style={{ color: '#94a3b8' }}>→</span>
                    <span style={{ background: '#cffafe', color: '#06b6d4', padding: '6px 12px', borderRadius: '6px' }}>
                        Feature Engineering
                    </span>
                    <span style={{ color: '#94a3b8' }}>→</span>
                    <span style={{ background: '#dcfce7', color: '#10b981', padding: '6px 12px', borderRadius: '6px' }}>
                        LSTM-Attention Model
                    </span>
                    <span style={{ color: '#94a3b8' }}>→</span>
                    <span style={{ background: '#fef3c7', color: '#f59e0b', padding: '6px 12px', borderRadius: '6px' }}>
                        Prediction
                    </span>
                </div>
            </div>

        </div>
    )
}
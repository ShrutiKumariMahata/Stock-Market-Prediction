import { useState, useEffect, useMemo, useCallback } from 'react'
import MetricCard, { PriceCard, ChangeCard } from '../components/ui/MetricCard'
import SignalBadge, { PredictionBadge, SentimentBadge } from '../components/ui/SignalBadge'
import PriceChart from '../components/charts/PriceChart'
import useStockData from '../hooks/useStockData'
import usePrediction from '../hooks/usePrediction'

const TICKERS = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' }
]

const HORIZONS = [
    { label: '1 Day', value: '1d', desc: 'Short-term' },
    { label: '5 Days', value: '5d', desc: 'Weekly' },
    { label: '1 Month', value: '1m', desc: 'Monthly' },
]

// Consistent card style for all boxes
const card = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
}

// Style for metric cards (boxes) - all consistent with black text
const metricCardStyle = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
}

export default function Dashboard() {
    const [ticker, setTicker] = useState('AAPL')
    const [horizon, setHorizon] = useState('1d')
    const [predictionHistory, setPredictionHistory] = useState([])

    const {
        data: stockData,
        loading: stockLoading,
        stats: stockStats,
        error: stockError
    } = useStockData(ticker, '3mo')

    const {
        result,
        loading: predLoading,
        error: predError,
        predict,
        retry,
        clearResult
    } = usePrediction({
        retryCount: 2,
        cacheResults: true,
        autoClearError: true
    })

    const handlePredict = useCallback(async () => {
        const predictionResult = await predict(ticker, horizon)
        if (predictionResult) {
            setPredictionHistory(prev => [
                {
                    ticker,
                    horizon,
                    timestamp: new Date().toISOString(),
                    prediction: predictionResult
                },
                ...prev
            ].slice(0, 10))
        }
    }, [ticker, horizon, predict])

    const chartData = useMemo(() => {
        const historical = stockData.map(d => ({
            date: d.date,
            close: d.close,
            volume: d.volume,
            forecast: null,
            upper_bound: null,
            lower_bound: null
        }))

        if (result?.forecast_series && result.forecast_series.length > 0) {
            result.forecast_series.forEach(point => {
                historical.push({
                    date: point.date,
                    close: null,
                    forecast: point.forecast,
                    upper_bound: point.upper_bound,
                    lower_bound: point.lower_bound,
                    volume: null
                })
            })
        }

        return historical
    }, [stockData, result])

    const modelInfo = useMemo(() => {
        return [
            { label: 'Model Type', value: 'LSTM + Attention' },
            { label: 'Input Features', value: '5 (OHLCV)' },
            { label: 'LSTM Layers', value: '2' },
            { label: 'Hidden Size', value: '128' },
            { label: 'Attention Heads', value: '8' },
            { label: 'Device', value: 'CPU' },
        ]
    }, [])

    const selectedTickerName = TICKERS.find(t => t.symbol === ticker)?.name || ticker

    // Get signal text without emoji
    const getSignalText = (signal) => {
        if (signal === 'BUY') return 'BUY'
        if (signal === 'SELL') return 'SELL'
        return 'HOLD'
    }

    return (
        <div style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '1400px',
            margin: '0 auto',
            background: '#f8fafc',
            minHeight: '100vh'
        }}>

            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#2563eb', margin: 0 }}>
                        Stock Trend Prediction
                    </h1>
                    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                        {selectedTickerName} • LSTM-Attention Model • Real-time Inference
                        {stockStats?.lastUpdated && ` • Updated ${new Date(stockStats.lastUpdated).toLocaleTimeString()}`}
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                alignItems: 'center',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                <select
                    value={ticker}
                    onChange={e => {
                        setTicker(e.target.value)
                        clearResult()
                    }}
                    disabled={predLoading}
                    style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: '#1e293b',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        minWidth: '140px'
                    }}
                >
                    {TICKERS.map(t => (
                        <option key={t.symbol} value={t.symbol}>
                            {t.symbol} - {t.name}
                        </option>
                    ))}
                </select>

                <div style={{ display: 'flex', gap: '4px' }}>
                    {HORIZONS.map(h => (
                        <button
                            key={h.value}
                            onClick={() => setHorizon(h.value)}
                            disabled={predLoading}
                            title={h.desc}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: `1px solid ${horizon === h.value ? '#2563eb' : '#e2e8f0'}`,
                                background: horizon === h.value ? '#eff6ff' : '#ffffff',
                                color: horizon === h.value ? '#2563eb' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: horizon === h.value ? '600' : '400',
                                transition: 'all 0.2s'
                            }}
                        >
                            {h.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handlePredict}
                    disabled={predLoading || stockLoading}
                    style={{
                        background: predLoading ? '#cbd5e1' : '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 24px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: predLoading ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        marginLeft: 'auto'
                    }}
                >
                    {predLoading ? (
                        <>
                            <span style={{ animation: 'spin 1s linear infinite' }}>⌛</span>
                            Analyzing...
                        </>
                    ) : (
                        <>Run Prediction</>
                    )}
                </button>
            </div>

            {/* Error Display */}
            {(stockError || predError) && (
                <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    color: '#dc2626',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>⚠️ {stockError || predError}</span>
                    <button onClick={retry} style={{
                        background: '#dc262620',
                        border: 'none',
                        color: '#dc2626',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Metrics Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px'
            }}>
                {/* Current Price Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>CURRENT PRICE</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                        {stockLoading ? '...' : (result ? result.current_price : (stockStats?.price?.current || '—'))}
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>{ticker}</div>
                </div>

                {/* Predicted Price Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>PREDICTED PRICE</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                        {predLoading ? '...' : (result ? result.predicted_price : '—')}
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>{result ? horizon : 'Run prediction'}</div>
                </div>

                {/* Expected Change Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>EXPECTED CHANGE</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                        {predLoading ? '...' : (result ? `${result.change_pct > 0 ? '+' : ''}${result.change_pct}%` : '—')}
                    </div>
                </div>

                {/* Confidence Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>CONFIDENCE</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                        {predLoading ? '...' : (result ? `${result.confidence}%` : '—')}
                    </div>
                </div>

                {/* Signal Badge Card */}
                <div style={metricCardStyle}>
                    {result ? (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>SIGNAL</div>
                            <div style={{ 
                                fontSize: '20px', 
                                fontWeight: '700', 
                                color: result.signal === 'BUY' ? '#22c55e' : result.signal === 'SELL' ? '#ef4444' : '#f59e0b',
                                textTransform: 'uppercase'
                            }}>
                                {getSignalText(result.signal)}
                            </div>
                            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                                Confidence: {result.confidence}%
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>SIGNAL</div>
                            <div style={{ fontSize: '14px', color: '#94a3b8' }}>Awaiting prediction</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Price Chart */}
            <div style={card}>
                <div style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#475569',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>
                        {ticker} Price Chart • {horizon} Forecast
                        {result && (
                            <span style={{ marginLeft: '8px' }}>
                                <SignalBadge signal={result.signal} size="small" />
                            </span>
                        )}
                    </span>
                    {result && (
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            Forecast confidence: {result.confidence}%
                        </span>
                    )}
                </div>
                {stockLoading ? (
                    <div style={{
                        color: '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        padding: '60px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <div style={{ animation: 'spin 1s linear infinite', fontSize: '24px' }}>⌛</div>
                        Loading {ticker} data...
                    </div>
                ) : (
                    <PriceChart
                        data={chartData}
                        forecastStart={stockData.length > 0 ? stockData[stockData.length - 1]?.date : null}
                        showConfidenceInterval={true}
                        currentPrice={result?.current_price || stockStats?.price?.current}
                        predictedPrice={result?.predicted_price}
                    />
                )}
            </div>

            {/* Model Analysis */}
            {result && (
                <>
                    <div style={card}>
                        <div style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#475569',
                            marginBottom: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span>Model Analysis</span>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                Generated {new Date().toLocaleString()}
                            </span>
                        </div>
                        <p style={{
                            fontSize: '13px',
                            color: '#475569',
                            lineHeight: '1.7',
                            background: '#f8fafc',
                            padding: '16px',
                            borderRadius: '8px',
                            borderLeft: '3px solid #2563eb'
                        }}>
                            {result.analysis}
                        </p>

                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginTop: '14px'
                        }}>
                            {modelInfo.map(({ label, value }) => (
                                <span
                                    key={label}
                                    style={{
                                        fontSize: '10px',
                                        padding: '4px 10px',
                                        background: '#f1f5f9',
                                        borderRadius: '4px',
                                        color: '#64748b',
                                        display: 'flex',
                                        gap: '4px'
                                    }}
                                >
                                    <span style={{ color: '#475569' }}>{label}:</span>
                                    <span style={{ color: '#1e293b', fontWeight: '600' }}>{value}</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Prediction History */}
                    {predictionHistory.length > 1 && (
                        <div style={card}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '12px' }}>
                                Recent Predictions
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {predictionHistory.slice(0, 5).map((item, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 12px',
                                        background: i === 0 ? '#eff6ff' : 'transparent',
                                        borderRadius: '6px',
                                        fontSize: '12px'
                                    }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <span style={{ color: '#475569' }}>{item.ticker}</span>
                                            <span style={{ color: '#94a3b8' }}>{item.horizon}</span>
                                            <span style={{ 
                                                color: item.prediction.signal === 'BUY' ? '#22c55e' : item.prediction.signal === 'SELL' ? '#ef4444' : '#f59e0b',
                                                fontWeight: '600',
                                                fontSize: '11px'
                                            }}>
                                                {getSignalText(item.prediction.signal)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <span style={{ color: item.prediction.change_pct > 0 ? '#22c55e' : '#ef4444' }}>
                                                {item.prediction.change_pct > 0 ? '+' : ''}{item.prediction.change_pct}%
                                            </span>
                                            <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                                                {new Date(item.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Empty State */}
            {!result && !predLoading && !stockLoading && (
                <div style={{
                    ...card,
                    textAlign: 'center',
                    padding: '60px 20px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px', color: '#94a3b8' }}>📈</div>
                    <div style={{ fontSize: '16px', marginBottom: '4px', color: '#1e293b' }}>
                        Ready to Predict
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                        Select a stock and horizon, then click "Run Prediction"
                    </div>
                </div>
            )}
        </div>
    )
}
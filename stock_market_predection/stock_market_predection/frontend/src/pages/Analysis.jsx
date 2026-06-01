import { useState, useMemo, useCallback } from 'react'
import useStockData from '../hooks/useStockData'
import PriceChart from '../components/charts/PriceChart'
import MetricCard, { PriceCard, ChangeCard, VolumeCard } from '../components/ui/MetricCard'
import SignalBadge, { TrendBadge, RSIBadge } from '../components/ui/SignalBadge'
import { getPrediction } from '../services/api'

const TICKERS = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' }
]

const PERIODS = [
    { value: '1mo', label: '1 Month' },
    { value: '3mo', label: '3 Months' },
    { value: '6mo', label: '6 Months' },
    { value: '1y', label: '1 Year' },
    { value: '2y', label: '2 Years' },
    { value: '5y', label: '5 Years' }
]

const VIEWS = {
    CHART: 'chart',
    TABLE: 'table',
    STATS: 'stats'
}

const card = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
}

// Consistent metric card style with smaller font
const metricCardStyle = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
}

export default function Analysis() {
    const [ticker, setTicker] = useState('AAPL')
    const [period, setPeriod] = useState('3mo')
    const [view, setView] = useState(VIEWS.CHART)
    const [comparisonMode, setComparisonMode] = useState(false)
    const [compareTicker, setCompareTicker] = useState('MSFT')

    const {
        data,
        loading,
        error,
        stats,
        refresh,
        isEmpty,
        isReady
    } = useStockData(ticker, period, {
        includeInfo: true,
        onSuccess: () => console.log(`Loaded ${ticker} data`)
    })

    // Comparison data
    const { data: compareData } = useStockData(
        comparisonMode ? compareTicker : null,
        period
    )

    // Calculate additional metrics
    const metrics = useMemo(() => {
        if (!data || data.length === 0) return null

        const latest = data[data.length - 1]
        const oldest = data[0]
        const priceChange = ((latest.close - oldest.close) / oldest.close * 100)
        const priceChangeAbs = latest.close - oldest.close

        // Calculate moving averages
        const sma20 = data.slice(-20).reduce((sum, d) => sum + d.close, 0) / Math.min(20, data.length)
        const sma50 = data.slice(-50).reduce((sum, d) => sum + d.close, 0) / Math.min(50, data.length)

        // Volume trend
        const avgVolume10 = data.slice(-10).reduce((sum, d) => sum + d.volume, 0) / 10
        const avgVolume30 = data.slice(-30).reduce((sum, d) => sum + d.volume, 0) / Math.min(30, data.length)
        const volumeRatio = avgVolume10 / avgVolume30

        // Volatility
        const returns = []
        for (let i = 1; i < data.length; i++) {
            returns.push((data[i].close - data[i - 1].close) / data[i - 1].close)
        }
        const volatility = Math.sqrt(
            returns.reduce((sum, r) => sum + r * r, 0) / returns.length
        ) * Math.sqrt(252) * 100

        return {
            latest,
            oldest,
            priceChange,
            priceChangeAbs,
            sma20,
            sma50,
            avgVolume10,
            volumeRatio,
            volatility,
            trendSignal: latest.close > sma20 ? 'Bullish' : 'Bearish',
            maSignal: sma20 > sma50 ? 'Golden Cross' : sma20 < sma50 ? 'Death Cross' : 'Neutral'
        }
    }, [data])

    // Chart data with comparison
    const chartData = useMemo(() => {
        const mainData = data.map(d => ({
            date: d.date,
            close: d.close,
            volume: d.volume
        }))

        if (comparisonMode && compareData && compareData.length > 0) {
            // Normalize comparison data to same scale
            const mainFirst = data[0]?.close || 1
            const compareFirst = compareData[0]?.close || 1
            const ratio = mainFirst / compareFirst

            return mainData.map((d, i) => ({
                ...d,
                compare: compareData[i] ? compareData[i].close * ratio : null
            }))
        }

        return mainData
    }, [data, compareData, comparisonMode])

    // Export data
    const exportData = useCallback(() => {
        if (!data || data.length === 0) return

        const csv = [
            ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'].join(','),
            ...data.map(d => [d.date, d.open, d.high, d.low, d.close, d.volume].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${ticker}_${period}_data.csv`
        a.click()
        URL.revokeObjectURL(url)
    }, [data, ticker, period])

    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>

            {/* Header Section */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                        Market Analysis
                    </h1>
                    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                        Real-time data via Yahoo Finance • Last updated: {stats?.lastUpdated || 'N/A'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Ticker selector */}
                    <select
                        value={ticker}
                        onChange={e => setTicker(e.target.value)}
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: '#1e293b',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            minWidth: '120px'
                        }}
                    >
                        {TICKERS.map(t => (
                            <option key={t.symbol} value={t.symbol}>
                                {t.symbol} - {t.name}
                            </option>
                        ))}
                    </select>

                    {/* Period selector */}
                    <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: '#1e293b',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        {PERIODS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>

                    {/* Refresh button */}
                    <button
                        onClick={refresh}
                        disabled={loading}
                        style={{
                            background: loading ? '#e2e8f0' : '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: loading ? '#94a3b8' : '#1e293b',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Comparison mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={comparisonMode}
                        onChange={e => setComparisonMode(e.target.checked)}
                        style={{ accentColor: '#2563eb' }}
                    />
                    <span style={{ color: '#475569', fontSize: '12px' }}>Compare with:</span>
                </label>
                {comparisonMode && (
                    <select
                        value={compareTicker}
                        onChange={e => setCompareTicker(e.target.value)}
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: '#1e293b',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '12px'
                        }}
                    >
                        {TICKERS.filter(t => t.symbol !== ticker).map(t => (
                            <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Error display */}
            {error && (
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
                    <span>⚠️ {error}</span>
                    <button
                        onClick={refresh}
                        style={{
                            background: '#dc262620',
                            border: 'none',
                            color: '#dc2626',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Empty state */}
            {isEmpty && !loading && !error && (
                <div style={{
                    ...card,
                    textAlign: 'center',
                    padding: '60px 20px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px', color: '#94a3b8' }}>📊</div>
                    <div style={{ fontSize: '16px', marginBottom: '4px', color: '#1e293b' }}>No data available</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                        Select a ticker and period to view stock data
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    {[...Array(8)].map((_, i) => (
                        <div key={i} style={metricCardStyle}>
                            <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '8px' }}></div>
                            <div style={{ height: '20px', background: '#e2e8f0', borderRadius: '4px', width: '60%' }}></div>
                        </div>
                    ))}
                </div>
            )}

            {/* Metrics Grid - All boxes with smaller font sizes */}
            {isReady && metrics && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '12px'
                }}>
                    {/* Latest Close Card */}
                    <div style={metricCardStyle}>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>LATEST CLOSE</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                            ${metrics.latest.close.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>{metrics.latest.date}</div>
                    </div>

                    {/* Period High Card */}
                    <div style={metricCardStyle}>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>PERIOD HIGH</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                            ${stats?.price?.high?.toFixed(2) || '—'}
                        </div>
                    </div>

                    {/* Period Low Card */}
                    <div style={metricCardStyle}>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>PERIOD LOW</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                            ${stats?.price?.low?.toFixed(2) || '—'}
                        </div>
                    </div>

                    {/* Period Change Card */}
                    <div style={metricCardStyle}>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>PERIOD CHANGE</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                            {metrics.priceChange > 0 ? '↑' : metrics.priceChange < 0 ? '↓' : ''} {Math.abs(metrics.priceChange).toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                            ${Math.abs(metrics.priceChangeAbs).toFixed(2)}
                        </div>
                    </div>

                    {/* Volatility Card */}
                    <div style={metricCardStyle}>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>VOLATILITY</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                            {metrics.volatility.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>Annualized</div>
                    </div>

                    {/* MA Signal Card */}
                    <div style={metricCardStyle}>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>MA SIGNAL</div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                            {metrics.maSignal}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                            SMA20: ${metrics.sma20.toFixed(2)} | SMA50: ${metrics.sma50.toFixed(2)}
                        </div>
                    </div>

                    {/* Avg Volume Card */}
                    <div style={metricCardStyle}>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>AVG VOLUME</div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                            {metrics.avgVolume10.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                            {metrics.volumeRatio > 1 ? 'Above average' : 'Below average'}
                        </div>
                    </div>

                    {/* Total Records Card */}
                    <div style={metricCardStyle}>
                        <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>TOTAL RECORDS</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                            {stats?.records || data.length}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
                            {stats?.dateRange?.start} → {stats?.dateRange?.end}
                        </div>
                    </div>
                </div>
            )}

            {/* View Toggle */}
            {isReady && (
                <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
                    {Object.entries(VIEWS).map(([key, value]) => (
                        <button
                            key={key}
                            onClick={() => setView(value)}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: view === value ? '#ffffff' : 'transparent',
                                color: view === value ? '#2563eb' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: view === value ? '600' : '400',
                                transition: 'all 0.2s',
                                boxShadow: view === value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            )}

            {/* Price Chart */}
            {isReady && view === VIEWS.CHART && (
                <div style={card}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                    }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#475569' }}>
                            {ticker} · {PERIODS.find(p => p.value === period)?.label} · {comparisonMode ? `vs ${compareTicker}` : 'Price Chart'}
                        </span>
                        <button
                            onClick={exportData}
                            style={{
                                background: '#f1f5f9',
                                border: 'none',
                                color: '#475569',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            Export CSV
                        </button>
                    </div>
                    <PriceChart
                        data={chartData}
                        comparisonData={comparisonMode ? compareData : null}
                    />
                </div>
            )}

            {/* Statistics View */}
            {isReady && view === VIEWS.STATS && (
                <div style={card}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '16px' }}>
                        Statistical Summary
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        {/* Price statistics */}
                        <div>
                            <h4 style={{ color: '#64748b', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRICE STATISTICS</h4>
                            {stats?.price && Object.entries(stats.price).map(([key, value]) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b' }}>{key}</span>
                                    <span style={{ color: '#1e293b', fontFamily: 'monospace' }}>
                                        {typeof value === 'number' ? value.toFixed(2) : value}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {/* Volume statistics */}
                        <div>
                            <h4 style={{ color: '#64748b', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VOLUME STATISTICS</h4>
                            {stats?.volume && Object.entries(stats.volume).map(([key, value]) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b' }}>{key}</span>
                                    <span style={{ color: '#1e293b', fontFamily: 'monospace' }}>
                                        {typeof value === 'number' ? value.toLocaleString() : value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* OHLCV Table */}
            {isReady && view === VIEWS.TABLE && (
                <div style={card}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '12px' }}>
                        Raw OHLCV Data · Last 20 records
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'monospace' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    {['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Change %'].map(h => (
                                        <th key={h} style={{
                                            textAlign: 'left',
                                            padding: '10px 12px',
                                            color: '#64748b',
                                            borderBottom: '1px solid #e2e8f0',
                                            fontWeight: '600',
                                            fontSize: '11px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.slice(-20).reverse().map((row, i) => {
                                    const prevClose = data[data.indexOf(row) - 1]?.close
                                    const changePercent = prevClose
                                        ? ((row.close - prevClose) / prevClose * 100).toFixed(2)
                                        : null

                                    return (
                                        <tr
                                            key={i}
                                            style={{
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{row.date}</td>
                                            <td style={{ padding: '8px 12px', color: '#475569' }}>${row.open.toFixed(2)}</td>
                                            <td style={{ padding: '8px 12px', color: '#22c55e' }}>${row.high.toFixed(2)}</td>
                                            <td style={{ padding: '8px 12px', color: '#ef4444' }}>${row.low.toFixed(2)}</td>
                                            <td style={{ padding: '8px 12px', color: '#2563eb', fontWeight: '600' }}>${row.close.toFixed(2)}</td>
                                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{row.volume.toLocaleString()}</td>
                                            <td style={{
                                                padding: '8px 12px',
                                                color: changePercent > 0 ? '#22c55e' : changePercent < 0 ? '#ef4444' : '#64748b',
                                                fontWeight: '600'
                                            }}>
                                                {changePercent ? `${changePercent > 0 ? '+' : ''}${changePercent}%` : '—'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    )
}
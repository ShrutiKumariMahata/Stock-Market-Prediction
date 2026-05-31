import {
    ResponsiveContainer, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ReferenceLine, ReferenceArea, Brush
} from 'recharts'
import { useState, useEffect, useMemo } from 'react'

export default function PriceChart({
    data,
    forecastStart,
    isLoading = false,
    showConfidenceInterval = true,
    height = 280,
    currentPrice = null,   // ← add
    predictedPrice = null  // ← add
}) {
    const [chartData, setChartData] = useState([])
    const [stats, setStats] = useState({
        currentPrice: 0,
        predictedPrice: 0,
        changePercent: 0,
        changeAbsolute: 0,
        signal: 'HOLD',
        highPrice: 0,
        lowPrice: 0,
        volatility: 0
    })

    useEffect(() => {
        if (data && data.length > 0) {
            // Process data and add derived metrics
            const processed = data.map((point, index) => ({
                ...point,
                // Add confidence bands if available
                upperBound: point.forecast ? point.forecast * 1.02 : null,
                lowerBound: point.forecast ? point.forecast * 0.98 : null,
                // Add returns
                dailyReturn: index > 0 && point.close ?
                    ((point.close - data[index - 1].close) / data[index - 1].close * 100) : null,
                // Add volume normalized
                volumeNorm: point.volume ? point.volume / 1000000 : null // Millions
            }))

            setChartData(processed)

            // Calculate statistics
            const historicalData = data.filter(d => !d.forecast || d.close === d.forecast)
            const forecastData = data.filter(d => d.forecast && d.close !== d.forecast)

            const currentPrice = historicalData.length > 0 ?
                historicalData[historicalData.length - 1].close : 0

            const predictedPrice = forecastData.length > 0 ?
                forecastData[forecastData.length - 1].forecast : currentPrice

            const allPrices = historicalData.map(d => d.close).filter(p => p)

            setStats({
                currentPrice,
                predictedPrice,
                changePercent: currentPrice ?
                    ((predictedPrice - currentPrice) / currentPrice * 100) : 0,
                changeAbsolute: predictedPrice - currentPrice,
                signal: predictedPrice > currentPrice * 1.02 ? 'BUY' :
                    predictedPrice < currentPrice * 0.98 ? 'SELL' : 'HOLD',
                highPrice: Math.max(...allPrices),
                lowPrice: Math.min(...allPrices),
                volatility: allPrices.length > 1 ?
                    (Math.max(...allPrices) - Math.min(...allPrices)) /
                    (allPrices.reduce((a, b) => a + b, 0) / allPrices.length) * 100 : 0
            })
        }
    }, [data])

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0]?.payload
            const isForecast = dataPoint?.forecast &&
                (!dataPoint?.close || dataPoint.close !== dataPoint.forecast)

            return (
                <div style={{
                    background: '#0f1117',
                    border: `1px solid ${isForecast ? '#22d3ee33' : '#1e293b'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    minWidth: '160px'
                }}>
                    <div style={{
                        color: '#94a3b8',
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>{label}</span>
                        {isForecast && (
                            <span style={{
                                background: '#22d3ee22',
                                color: '#22d3ee',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '9px'
                            }}>
                                FORECAST
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {payload.map((entry, index) => {
                            const colors = {
                                'Historical': '#6366f1',
                                'Forecast': '#22d3ee',
                                'Upper Bound': '#22d3ee88',
                                'Lower Bound': '#22d3ee88',
                                'Volume': '#475569'
                            }

                            if (entry.dataKey === 'volumeNorm') return null

                            return (
                                <div key={index} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '20px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: colors[entry.name] || entry.color
                                        }} />
                                        <span style={{ color: '#64748b' }}>
                                            {entry.name}:
                                        </span>
                                    </div>
                                    <span style={{
                                        color: colors[entry.name] || entry.color,
                                        fontWeight: 'bold'
                                    }}>
                                        ${Number(entry.value).toFixed(2)}
                                    </span>
                                </div>
                            )
                        })}

                        {dataPoint?.dailyReturn && (
                            <div style={{
                                marginTop: '4px',
                                paddingTop: '4px',
                                borderTop: '1px solid #1e293b'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <span style={{ color: '#64748b', fontSize: '10px' }}>Daily Return:</span>
                                    <span style={{
                                        color: dataPoint.dailyReturn > 0 ? '#22c55e' : '#ef4444',
                                        fontSize: '10px',
                                        fontWeight: 'bold'
                                    }}>
                                        {dataPoint.dailyReturn > 0 ? '+' : ''}
                                        {dataPoint.dailyReturn.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        )}

                        {dataPoint?.volume && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '10px'
                            }}>
                                <span style={{ color: '#64748b' }}>Volume:</span>
                                <span style={{ color: '#475569' }}>
                                    {(dataPoint.volume / 1000000).toFixed(1)}M
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )
        }
        return null
    }

    // Custom legend
    const renderLegend = (props) => {
        const { payload } = props

        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '20px',
                padding: '8px 0'
            }}>
                {payload.map((entry, index) => (
                    <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        color: '#94a3b8'
                    }}>
                        <div style={{
                            width: '20px',
                            height: '2px',
                            background: entry.color,
                            borderStyle: entry.dataKey === 'forecast' ? 'dashed' : 'solid'
                        }} />
                        {entry.value}
                    </div>
                ))}
            </div>
        )
    }

    if (isLoading) {
        return (
            <div style={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <div className="loading-spinner" />
                <span>Loading price data...</span>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div style={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569'
            }}>
                No price data available
            </div>
        )
    }

    return (
        <div>
            {/* Price Stats */}
            {/* Price Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '8px',
                marginBottom: '12px',
                fontSize: '11px'
            }}>
                <div style={{
                    background: '#6366f122',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Current</div>
                    <div style={{ color: '#6366f1', fontWeight: 'bold', fontSize: '14px' }}>
                        ${(currentPrice || stats.currentPrice || 0).toFixed(2)}
                    </div>
                </div>

                <div style={{
                    background: '#22d3ee22',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Predicted</div>
                    <div style={{ color: '#22d3ee', fontWeight: 'bold', fontSize: '14px' }}>
                        ${(predictedPrice || stats.predictedPrice || 0).toFixed(2)}
                    </div>
                </div>

                <div style={{
                    background: (predictedPrice || stats.predictedPrice) > (currentPrice || stats.currentPrice) ? '#22c55e22' : '#ef444422',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Change</div>
                    <div style={{
                        color: (predictedPrice || stats.predictedPrice) > (currentPrice || stats.currentPrice) ? '#22c55e' : '#ef4444',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}>
                        {(() => {
                            const curr = currentPrice || stats.currentPrice || 0
                            const pred = predictedPrice || stats.predictedPrice || 0
                            const pct = curr ? ((pred - curr) / curr * 100) : 0
                            return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
                        })()}
                    </div>
                </div>

                <div style={{
                    background: '#1e293b',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Signal</div>
                    <div style={{
                        color: stats.signal === 'BUY' ? '#22c55e' :
                            stats.signal === 'SELL' ? '#ef4444' : '#eab308',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}>
                        {(predictedPrice || stats.predictedPrice) > (currentPrice || stats.currentPrice) ? 'BUY' :
                            (predictedPrice || stats.predictedPrice) < (currentPrice || stats.currentPrice) ? 'SELL' : 'HOLD'}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="historicalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                        <filter id="glowHistorical">
                            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        tickLine={false}
                        axisLine={{ stroke: '#1e293b' }}
                        minTickGap={30}
                    />

                    <YAxis
                        tick={{ fontSize: 10, fill: '#475569' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => `$${v}`}
                        domain={['auto', 'auto']}
                        width={60}
                    />

                    <Tooltip content={<CustomTooltip />} />

                    <Legend content={renderLegend} />

                    {/* Forecast separator */}
                    {forecastStart && (
                        <ReferenceLine
                            x={forecastStart}
                            stroke="#334155"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{
                                value: '🔮 Forecast Start',
                                fill: '#22d3ee',
                                fontSize: 10,
                                position: 'top'
                            }}
                        />
                    )}

                    {/* Forecast area highlight */}
                    {forecastStart && (
                        <ReferenceArea
                            x1={forecastStart}
                            fill="#22d3ee"
                            fillOpacity={0.02}
                        />
                    )}

                    {/* Confidence interval (upper bound) */}
                    {showConfidenceInterval && (
                        <Line
                            type="monotone"
                            dataKey="upper_bound"
                            stroke="#22d3ee99"  // was #22d3ee44
                            strokeWidth={1.5}   // was 1
                            strokeDasharray="2 2"
                            dot={false}
                            name="Upper Bound"
                            connectNulls={true}
                        />
                    )}

                    {/* Confidence interval (lower bound) */}
                    {showConfidenceInterval && (
                        <Line
                            type="monotone"
                            dataKey="lower_bound"
                            stroke="#22d3ee99"  // was #22d3ee44
                            strokeWidth={1.5}   // was 1
                            strokeDasharray="2 2"
                            dot={false}
                            name="Lower Bound"
                            connectNulls={true}
                        />
                    )}

                    {/* Historical price line */}
                    <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                        name="Historical"
                        filter="url(#glowHistorical)"
                        connectNulls={true}
                    />

                    {/* Forecast price line */}
                    <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={false}
                        name="Forecast"
                        connectNulls={true}
                    />

                    {/* Brush for zooming/panning */}
                    <Brush
                        dataKey="date"
                        height={20}
                        stroke="#6366f1"
                        fill="#1e293b"
                        tickFormatter={() => ''}
                        startIndex={Math.max(0, data.length - 60)}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
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
    currentPrice = null,
    predictedPrice = null,
    comparisonData = null,        // ← ADDED: For comparison stock data
    comparisonLabel = null        // ← ADDED: Label for comparison stock
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
                upperBound: point.upper_bound || (point.forecast ? point.forecast * 1.05 : null),
                lowerBound: point.lower_bound || (point.forecast ? point.forecast * 0.95 : null),
                // Add returns
                dailyReturn: index > 0 && point.close ?
                    ((point.close - data[index - 1].close) / data[index - 1].close * 100) : null,
                // Add volume normalized
                volumeNorm: point.volume ? point.volume / 1000000 : null
            }))

            // If comparison data exists, merge it
            if (comparisonData && comparisonData.length > 0) {
                comparisonData.forEach((compPoint, idx) => {
                    if (processed[idx]) {
                        processed[idx].comparison = compPoint.close
                    }
                })
            }

            setChartData(processed)

            // Calculate statistics
            const historicalData = data.filter(d => !d.forecast || d.close === d.forecast)
            const forecastData = data.filter(d => d.forecast && d.close !== d.forecast)

            const currPrice = (currentPrice !== null && currentPrice !== undefined) ? currentPrice :
                (historicalData.length > 0 ? historicalData[historicalData.length - 1]?.close : 0)

            const predPrice = (predictedPrice !== null && predictedPrice !== undefined) ? predictedPrice :
                (forecastData.length > 0 ? forecastData[forecastData.length - 1]?.forecast : currPrice)

            const allPrices = historicalData.map(d => d.close).filter(p => p)

            setStats({
                currentPrice: currPrice,
                predictedPrice: predPrice,
                changePercent: currPrice ? ((predPrice - currPrice) / currPrice * 100) : 0,
                changeAbsolute: predPrice - currPrice,
                signal: predPrice > currPrice * 1.02 ? 'BUY' :
                    predPrice < currPrice * 0.98 ? 'SELL' : 'HOLD',
                highPrice: Math.max(...allPrices, currPrice),
                lowPrice: Math.min(...allPrices, currPrice),
                volatility: allPrices.length > 1 ?
                    (Math.max(...allPrices) - Math.min(...allPrices)) /
                    (allPrices.reduce((a, b) => a + b, 0) / allPrices.length) * 100 : 0
            })
        }
    }, [data, currentPrice, predictedPrice, comparisonData])

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0]?.payload
            const isForecast = dataPoint?.forecast &&
                (!dataPoint?.close || dataPoint.close !== dataPoint.forecast)

            return (
                <div style={{
                    background: '#ffffff',
                    border: `1px solid ${isForecast ? '#22d3ee33' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    minWidth: '180px'
                }}>
                    <div style={{
                        color: '#475569',
                        marginBottom: '8px',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>{label}</span>
                        {isForecast && (
                            <span style={{
                                background: '#22d3ee20',
                                color: '#06b6d4',
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
                                'Historical': '#2563eb',
                                'Forecast': '#06b6d4',
                                'Upper Bound': '#06b6d488',
                                'Lower Bound': '#06b6d488',
                                'Volume': '#64748b',
                                'Comparison': '#22c55e'
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
                                            background: colors[entry.name] || entry.color || '#64748b'
                                        }} />
                                        <span style={{ color: '#64748b' }}>
                                            {entry.name}:
                                        </span>
                                    </div>
                                    <span style={{
                                        color: colors[entry.name] || entry.color || '#1e293b',
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
                                borderTop: '1px solid #e2e8f0'
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
                padding: '8px 0',
                flexWrap: 'wrap'
            }}>
                {payload.map((entry, index) => {
                    let lineStyle = {}
                    if (entry.dataKey === 'forecast') {
                        lineStyle = { borderTop: '2px dashed #06b6d4' }
                    } else if (entry.dataKey === 'comparison') {
                        lineStyle = { borderTop: '2px solid #22c55e' }
                    } else {
                        lineStyle = { borderTop: `2px solid ${entry.color}` }
                    }
                    
                    return (
                        <div key={index} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            color: '#64748b'
                        }}>
                            <div style={{
                                width: '24px',
                                height: '2px',
                                ...lineStyle
                            }} />
                            <span>{entry.value}</span>
                        </div>
                    )
                })}
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
                color: '#64748b',
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
                color: '#64748b'
            }}>
                No price data available
            </div>
        )
    }

    const displayCurrent = currentPrice !== null && currentPrice !== undefined ? currentPrice : stats.currentPrice
    const displayPredicted = predictedPrice !== null && predictedPrice !== undefined ? predictedPrice : stats.predictedPrice
    const changePercent = displayCurrent ? ((displayPredicted - displayCurrent) / displayCurrent * 100) : 0

    return (
        <div>
            {/* Price Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '8px',
                marginBottom: '12px',
                fontSize: '11px'
            }}>
                <div style={{
                    background: '#eff6ff',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Current</div>
                    <div style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '14px' }}>
                        ${displayCurrent.toFixed(2)}
                    </div>
                </div>

                <div style={{
                    background: '#cffafe',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Predicted</div>
                    <div style={{ color: '#06b6d4', fontWeight: 'bold', fontSize: '14px' }}>
                        ${displayPredicted.toFixed(2)}
                    </div>
                </div>

                <div style={{
                    background: changePercent > 0 ? '#f0fdf4' : '#fef2f2',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Change</div>
                    <div style={{
                        color: changePercent > 0 ? '#22c55e' : '#ef4444',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}>
                        {changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%
                    </div>
                </div>

                <div style={{
                    background: changePercent > 5 ? '#f0fdf4' : changePercent < -5 ? '#fef2f2' : '#fefce8',
                    padding: '8px',
                    borderRadius: '6px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Signal</div>
                    <div style={{
                        color: changePercent > 5 ? '#22c55e' : changePercent < -5 ? '#ef4444' : '#eab308',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}>
                        {changePercent > 5 ? 'BUY' : changePercent < -5 ? 'SELL' : 'HOLD'}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="historicalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="comparisonGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                        minTickGap={30}
                    />

                    <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
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
                            stroke="#cbd5e1"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{
                                value: 'Forecast Start',
                                fill: '#64748b',
                                fontSize: 10,
                                position: 'top'
                            }}
                        />
                    )}

                    {/* Forecast area highlight */}
                    {forecastStart && (
                        <ReferenceArea
                            x1={forecastStart}
                            fill="#06b6d4"
                            fillOpacity={0.02}
                        />
                    )}

                    {/* Confidence interval (upper bound) */}
                    {showConfidenceInterval && (
                        <Line
                            type="monotone"
                            dataKey="upper_bound"
                            stroke="#06b6d480"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
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
                            stroke="#06b6d480"
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            dot={false}
                            name="Lower Bound"
                            connectNulls={true}
                        />
                    )}

                    {/* Historical price line - BLUE SOLID */}
                    <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        name="Historical"
                        connectNulls={true}
                    />

                    {/* Forecast price line - CYAN DASHED */}
                    <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Forecast"
                        connectNulls={true}
                    />

                    {/* Comparison stock line - GREEN SOLID (for when comparing) */}
                    {comparisonData && comparisonData.length > 0 && (
                        <Line
                            type="monotone"
                            dataKey="comparison"
                            stroke="#22c55e"
                            strokeWidth={2}
                            dot={false}
                            name={comparisonLabel || "Comparison"}
                            connectNulls={true}
                        />
                    )}

                    {/* Brush for zooming/panning */}
                    <Brush
                        dataKey="date"
                        height={20}
                        stroke="#2563eb"
                        fill="#f8fafc"
                        tickFormatter={() => ''}
                        startIndex={Math.max(0, data.length - 60)}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
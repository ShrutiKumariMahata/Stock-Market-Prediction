import {
    ResponsiveContainer, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ReferenceLine, Legend
} from 'recharts'
import { useState, useEffect } from 'react'

export default function AccuracyChart({ data, isLoading = false, targetAccuracy = 70 }) {
    const [chartData, setChartData] = useState([])
    const [stats, setStats] = useState({
        current: 0,
        best: 0,
        average: 0,
        trend: 'stable'
    })

    useEffect(() => {
        if (data && data.length > 0) {
            // Process data for better visualization
            const processed = data.map((point, index) => ({
                ...point,
                // Add smoothed accuracy for trend line
                smoothedAccuracy: calculateSMA(data, index, 5),
                // Add moving average
                maAccuracy: calculateMA(data, index, 3)
            }))

            setChartData(processed)

            // Calculate statistics
            const accuracies = data.map(d => d.accuracy)
            const current = accuracies[accuracies.length - 1]
            const best = Math.max(...accuracies)
            const average = accuracies.reduce((a, b) => a + b, 0) / accuracies.length

            // Determine trend
            const recentAvg = accuracies.slice(-5).reduce((a, b) => a + b, 0) / 5
            const previousAvg = accuracies.slice(-10, -5).reduce((a, b) => a + b, 0) / 5
            const trend = recentAvg > previousAvg ? 'improving' :
                recentAvg < previousAvg ? 'declining' : 'stable'

            setStats({ current, best, average, trend })
        }
    }, [data])

    // Calculate Simple Moving Average for smoothing
    const calculateSMA = (data, currentIndex, window) => {
        if (currentIndex < window - 1) return null
        const slice = data.slice(currentIndex - window + 1, currentIndex + 1)
        return slice.reduce((sum, d) => sum + d.accuracy, 0) / window
    }

    const calculateMA = (data, currentIndex, window) => {
        if (currentIndex < window - 1) return null
        const slice = data.slice(currentIndex - window + 1, currentIndex + 1)
        return slice.reduce((sum, d) => sum + d.accuracy, 0) / window
    }

    // Custom tooltip component
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload
            return (
                <div className="custom-tooltip" style={{
                    background: '#0f1117',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontWeight: 'bold' }}>
                        Epoch {label}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                            <span style={{ color: '#64748b' }}>Accuracy:</span>
                            <span style={{ color: '#22c55e', fontWeight: 'bold' }}>
                                {data.accuracy?.toFixed(2)}%
                            </span>
                        </div>
                        {data.smoothedAccuracy && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                <span style={{ color: '#64748b' }}>Smooth:</span>
                                <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>
                                    {data.smoothedAccuracy?.toFixed(2)}%
                                </span>
                            </div>
                        )}
                        {data.train_loss !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                                <span style={{ color: '#64748b' }}>Loss:</span>
                                <span style={{ color: '#ef4444' }}>
                                    {data.train_loss?.toFixed(4)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )
        }
        return null
    }

    // Custom dot component for best accuracy
    const CustomDot = (props) => {
        const { cx, cy, payload } = props
        const isBest = payload.accuracy === stats.best

        if (isBest) {
            return (
                <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#22c55e"
                    stroke="#0f1117"
                    strokeWidth={2}
                />
            )
        }
        return null
    }

    if (isLoading) {
        return (
            <div style={{
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569'
            }}>
                <div className="loading-spinner" />
                <span style={{ marginLeft: '8px' }}>Loading chart data...</span>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div style={{
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569'
            }}>
                No training data available yet
            </div>
        )
    }

    return (
        <div>
            {/* Stats Summary */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                marginBottom: '12px',
                fontSize: '12px'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#64748b' }}>Current</div>
                    <div style={{
                        color: stats.current >= targetAccuracy ? '#22c55e' : '#eab308',
                        fontWeight: 'bold',
                        fontSize: '16px'
                    }}>
                        {stats.current.toFixed(1)}%
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#64748b' }}>Best</div>
                    <div style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '16px' }}>
                        {stats.best.toFixed(1)}%
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#64748b' }}>Average</div>
                    <div style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '16px' }}>
                        {stats.average.toFixed(1)}%
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#64748b' }}>Trend</div>
                    <div style={{
                        color: stats.trend === 'improving' ? '#22c55e' :
                            stats.trend === 'declining' ? '#ef4444' : '#64748b',
                        fontWeight: 'bold',
                        fontSize: '12px'
                    }}>
                        {stats.trend === 'improving' ? '↗' :
                            stats.trend === 'declining' ? '↘' : '→'}
                        {' '}{stats.trend}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="smoothGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

                    <XAxis
                        dataKey="epoch"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        tickLine={false}
                        axisLine={{ stroke: '#1e293b' }}
                        label={{
                            value: 'Epoch',
                            position: 'insideBottom',
                            offset: -5,
                            style: { fontSize: 10, fill: '#475569' }
                        }}
                    />

                    <YAxis
                        domain={[
                            Math.max(0, Math.min(...data.map(d => d.accuracy)) - 10),
                            Math.min(100, Math.max(...data.map(d => d.accuracy)) + 10)
                        ]}
                        tick={{ fontSize: 10, fill: '#475569' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => `${v}%`}
                    />

                    {/* Target accuracy reference line */}
                    <ReferenceLine
                        y={targetAccuracy}
                        stroke="#eab308"
                        strokeDasharray="5 5"
                        label={{
                            value: `Target: ${targetAccuracy}%`,
                            position: 'right',
                            style: { fontSize: 10, fill: '#eab308' }
                        }}
                    />

                    <Tooltip content={<CustomTooltip />} />

                    <Legend
                        verticalAlign="top"
                        height={20}
                        iconType="line"
                        formatter={(value) => (
                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>{value}</span>
                        )}
                    />

                    {/* Smoothed trend line */}
                    <Area
                        type="monotone"
                        dataKey="smoothedAccuracy"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fill="url(#smoothGrad)"
                        dot={false}
                        name="Smoothed"
                        connectNulls={true}
                    />

                    {/* Main accuracy line */}
                    <Area
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#accGrad)"
                        dot={<CustomDot />}
                        name="Accuracy"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
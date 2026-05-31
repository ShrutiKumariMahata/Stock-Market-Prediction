import {
    ResponsiveContainer, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ReferenceLine, ReferenceArea
} from 'recharts'
import { useState, useEffect } from 'react'

export default function LossChart({ data, isLoading = false }) {
    const [chartData, setChartData] = useState([])
    const [stats, setStats] = useState({
        currentTrainLoss: 0,
        currentValLoss: 0,
        bestValLoss: 0,
        bestEpoch: 0,
        overfitting: false,
        overfittingScore: 0
    })

    useEffect(() => {
        if (data && data.length > 0) {
            // Process data with smoothing
            const processed = data.map((point, index) => ({
                ...point,
                smoothTrainLoss: calculateEMA(data, index, 'train_loss', 0.2),
                smoothValLoss: calculateEMA(data, index, 'val_loss', 0.2),
                lossGap: point.train_loss && point.val_loss ?
                    point.val_loss - point.train_loss : null
            }))

            setChartData(processed)

            // Calculate statistics
            const lastPoint = data[data.length - 1]
            const bestValIdx = data.reduce((minIdx, point, idx, arr) =>
                point.val_loss < arr[minIdx].val_loss ? idx : minIdx, 0
            )

            const currentTrainLoss = lastPoint.train_loss || 0
            const currentValLoss = lastPoint.val_loss || 0
            const bestValLoss = data[bestValIdx].val_loss
            const bestEpoch = data[bestValIdx].epoch

            // Detect overfitting
            const recentTrainLoss = data.slice(-5).reduce((sum, d) => sum + (d.train_loss || 0), 0) / 5
            const recentValLoss = data.slice(-5).reduce((sum, d) => sum + (d.val_loss || 0), 0) / 5
            const overfittingScore = recentValLoss - recentTrainLoss
            const overfitting = overfittingScore > 0.1 && recentValLoss > recentTrainLoss * 1.2

            setStats({
                currentTrainLoss,
                currentValLoss,
                bestValLoss,
                bestEpoch,
                overfitting,
                overfittingScore
            })
        }
    }, [data])

    // Calculate Exponential Moving Average for smoothing
    const calculateEMA = (data, currentIndex, key, alpha) => {
        if (currentIndex === 0) return data[0][key]
        const prevEMA = calculateEMA(data, currentIndex - 1, key, alpha)
        return alpha * data[currentIndex][key] + (1 - alpha) * prevEMA
    }

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
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
                        {payload.map((entry, index) => {
                            const colors = {
                                'Train loss': '#ef4444',
                                'Val loss': '#f97316',
                                'Smoothed train': '#dc2626',
                                'Smoothed val': '#ea580c',
                                'Loss gap': '#8b5cf6'
                            }
                            return (
                                <div key={index} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '20px'
                                }}>
                                    <span style={{ color: '#64748b' }}>
                                        {entry.name}:
                                    </span>
                                    <span style={{
                                        color: colors[entry.name] || '#94a3b8',
                                        fontWeight: 'bold'
                                    }}>
                                        {entry.value?.toFixed(4)}
                                    </span>
                                </div>
                            )
                        })}
                        {payload[0]?.payload.lossGap && (
                            <div style={{
                                marginTop: '4px',
                                paddingTop: '4px',
                                borderTop: '1px solid #1e293b',
                                fontSize: '10px',
                                color: payload[0].payload.lossGap > 0.05 ? '#ef4444' : '#22c55e'
                            }}>
                                {payload[0].payload.lossGap > 0.05 ? '⚠️ ' : '✅ '}
                                Gap: {payload[0].payload.lossGap.toFixed(4)}
                                {payload[0].payload.lossGap > 0.1 && ' (Potential overfitting)'}
                            </div>
                        )}
                    </div>
                </div>
            )
        }
        return null
    }

    // Custom dot for best validation loss
    const BestValDot = (props) => {
        const { cx, cy, payload } = props
        const isBest = payload.epoch === stats.bestEpoch

        if (isBest) {
            return (
                <g>
                    <circle cx={cx} cy={cy} r={5} fill="#f97316" stroke="#0f1117" strokeWidth={2} />
                    <text x={cx} y={cy - 10} textAnchor="middle" fill="#f97316" fontSize="10">
                        Best
                    </text>
                </g>
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
                <span style={{ marginLeft: '8px' }}>Loading loss data...</span>
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
                No loss data available yet
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
                fontSize: '12px',
                flexWrap: 'wrap',
                gap: '8px'
            }}>
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Train Loss</div>
                    <div style={{ color: '#ef4444', fontWeight: 'bold' }}>
                        {stats.currentTrainLoss.toFixed(4)}
                    </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Val Loss</div>
                    <div style={{ color: '#f97316', fontWeight: 'bold' }}>
                        {stats.currentValLoss.toFixed(4)}
                    </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Best Val</div>
                    <div style={{ color: '#22c55e', fontWeight: 'bold' }}>
                        {stats.bestValLoss.toFixed(4)}
                        <div style={{ fontSize: '9px', color: '#475569' }}>
                            Epoch {stats.bestEpoch}
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Status</div>
                    <div style={{
                        color: stats.overfitting ? '#ef4444' : '#22c55e',
                        fontWeight: 'bold',
                        fontSize: '10px'
                    }}>
                        {stats.overfitting ? '⚠️ Overfitting' : '✅ Healthy'}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
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
                        tick={{ fontSize: 10, fill: '#475569' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => v.toFixed(3)}
                        domain={['auto', 'auto']}
                    />

                    {/* Overfitting warning area */}
                    {stats.overfitting && (
                        <ReferenceArea
                            x1={data.length - 10}
                            x2={data.length}
                            fill="#ef4444"
                            fillOpacity={0.05}
                            label={{
                                value: 'Overfitting',
                                position: 'insideTop',
                                style: { fontSize: 10, fill: '#ef4444' }
                            }}
                        />
                    )}

                    {/* Convergence line */}
                    <ReferenceLine
                        y={stats.bestValLoss}
                        stroke="#22c55e"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                            value: `Best: ${stats.bestValLoss.toFixed(3)}`,
                            position: 'right',
                            style: { fontSize: 9, fill: '#22c55e' }
                        }}
                    />

                    <Tooltip content={<CustomTooltip />} />

                    <Legend
                        verticalAlign="top"
                        height={30}
                        iconType="line"
                        formatter={(value) => (
                            <span style={{ color: '#94a3b8', fontSize: '10px' }}>{value}</span>
                        )}
                    />

                    {/* Smoothed lines (dashed) */}
                    <Line
                        type="monotone"
                        dataKey="smoothTrainLoss"
                        stroke="#dc2626"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        name="Smoothed train"
                        connectNulls={true}
                    />
                    <Line
                        type="monotone"
                        dataKey="smoothValLoss"
                        stroke="#ea580c"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        name="Smoothed val"
                        connectNulls={true}
                    />

                    {/* Main loss lines */}
                    <Line
                        type="monotone"
                        dataKey="train_loss"
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        dot={false}
                        name="Train loss"
                        filter="url(#glow)"
                    />
                    <Line
                        type="monotone"
                        dataKey="val_loss"
                        stroke="#f97316"
                        strokeWidth={1.5}
                        dot={<BestValDot />}
                        name="Val loss"
                    />

                    {/* Loss gap line (overfitting indicator) */}
                    <Line
                        type="monotone"
                        dataKey="lossGap"
                        stroke="#8b5cf6"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        dot={false}
                        name="Loss gap"
                        connectNulls={true}
                        yAxisId={0}
                        hide={!chartData.some(d => d.lossGap !== null)}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
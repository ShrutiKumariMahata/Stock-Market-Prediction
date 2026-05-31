import { useState, useEffect } from 'react'

export default function SignalBadge({
    signal,
    confidence,
    size = 'medium',
    showConfidence = false,
    animated = false,
    onClick
}) {
    const [isPulsing, setIsPulsing] = useState(false)

    useEffect(() => {
        if (animated && (signal === 'STRONG_BUY' || signal === 'STRONG_SELL')) {
            setIsPulsing(true)
            const timer = setTimeout(() => setIsPulsing(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [signal, animated])

    // Signal configurations
    const signalConfig = {
        'STRONG_BUY': {
            color: '#22c55e',
            background: 'rgba(34, 197, 94, 0.15)',
            border: 'rgba(34, 197, 94, 0.4)',
            icon: '🚀',
            label: 'STRONG BUY',
            description: 'High confidence upward trend'
        },
        'BUY': {
            color: '#4ade80',
            background: 'rgba(74, 222, 128, 0.1)',
            border: 'rgba(74, 222, 128, 0.3)',
            icon: '📈',
            label: 'BUY',
            description: 'Moderate upward potential'
        },
        'HOLD': {
            color: '#eab308',
            background: 'rgba(234, 179, 8, 0.1)',
            border: 'rgba(234, 179, 8, 0.3)',
            icon: '⏸️',
            label: 'HOLD',
            description: 'No clear direction'
        },
        'SELL': {
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.1)',
            border: 'rgba(239, 68, 68, 0.3)',
            icon: '📉',
            label: 'SELL',
            description: 'Moderate downward risk'
        },
        'STRONG_SELL': {
            color: '#dc2626',
            background: 'rgba(220, 38, 38, 0.15)',
            border: 'rgba(220, 38, 38, 0.4)',
            icon: '🔻',
            label: 'STRONG SELL',
            description: 'High confidence downward trend'
        }
    }

    const config = signalConfig[signal] || {
        color: '#475569',
        background: 'rgba(71, 85, 105, 0.1)',
        border: 'rgba(71, 85, 105, 0.3)',
        icon: '❓',
        label: signal || 'UNKNOWN',
        description: 'No signal available'
    }

    // Size configurations
    const sizeConfig = {
        small: {
            padding: '2px 8px',
            fontSize: '10px',
            iconSize: '12px',
            confidenceSize: '9px'
        },
        medium: {
            padding: '4px 12px',
            fontSize: '12px',
            iconSize: '14px',
            confidenceSize: '10px'
        },
        large: {
            padding: '6px 16px',
            fontSize: '14px',
            iconSize: '16px',
            confidenceSize: '11px'
        }
    }

    const sizeStyle = sizeConfig[size] || sizeConfig.medium

    // Confidence color
    const getConfidenceColor = (conf) => {
        if (!conf) return '#475569'
        if (conf >= 80) return '#22c55e'
        if (conf >= 60) return '#eab308'
        return '#ef4444'
    }

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span
                onClick={onClick}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: sizeStyle.padding,
                    borderRadius: '20px',
                    fontSize: sizeStyle.fontSize,
                    fontWeight: '700',
                    background: config.background,
                    color: config.color,
                    border: `1px solid ${config.border}`,
                    cursor: onClick ? 'pointer' : 'default',
                    transition: 'all 0.3s ease',
                    userSelect: 'none',
                    letterSpacing: '0.3px',
                    ...(isPulsing && {
                        animation: 'pulse 2s ease-in-out infinite',
                        boxShadow: `0 0 20px ${config.color}44`
                    }),
                    ...(onClick && {
                        ':hover': {
                            transform: 'translateY(-1px)',
                            boxShadow: `0 2px 8px ${config.color}22`
                        }
                    })
                }}
                title={config.description}
            >
                {/* Signal icon */}
                <span style={{
                    fontSize: sizeStyle.iconSize,
                    lineHeight: '1',
                    animation: signal === 'STRONG_BUY' || signal === 'STRONG_SELL' ?
                        'bounce 1s ease infinite' : 'none'
                }}>
                    {config.icon}
                </span>

                {/* Signal label */}
                <span>{config.label}</span>

                {/* Confidence indicator */}
                {showConfidence && confidence !== undefined && (
                    <>
                        <span style={{
                            width: '1px',
                            height: '12px',
                            background: config.border,
                            margin: '0 2px'
                        }} />
                        <span style={{
                            fontSize: sizeStyle.confidenceSize,
                            color: getConfidenceColor(confidence),
                            fontWeight: '600'
                        }}>
                            {confidence}%
                        </span>
                    </>
                )}
            </span>

            {/* Animated pulse ring for strong signals */}
            {(signal === 'STRONG_BUY' || signal === 'STRONG_SELL') && animated && (
                <span style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '20px',
                    background: config.color,
                    opacity: 0,
                    animation: 'pulseRing 2s ease-out infinite',
                    pointerEvents: 'none'
                }} />
            )}
        </div>
    )
}

// Preset variants for common use cases
export const PredictionBadge = ({ prediction, confidence, ...props }) => {
    const getSignal = (pred, conf) => {
        if (pred > 0) return conf >= 80 ? 'STRONG_BUY' : 'BUY'
        if (pred < 0) return conf >= 80 ? 'STRONG_SELL' : 'SELL'
        return 'HOLD'
    }

    const signal = getSignal(prediction, confidence)

    return (
        <SignalBadge
            signal={signal}
            confidence={confidence}
            showConfidence={true}
            {...props}
        />
    )
}

export const SentimentBadge = ({ score, ...props }) => {
    const getSentiment = (s) => {
        if (s > 50) return s > 75 ? 'STRONG_BUY' : 'BUY'
        if (s < -50) return s < -75 ? 'STRONG_SELL' : 'SELL'
        return 'HOLD'
    }

    return (
        <SignalBadge
            signal={getSentiment(score)}
            confidence={Math.abs(score)}
            showConfidence={true}
            {...props}
        />
    )
}

export const RSIBadge = ({ value, ...props }) => {
    const getRSISignal = (rsi) => {
        if (rsi > 70) return 'SELL'  // Overbought
        if (rsi < 30) return 'BUY'    // Oversold
        return 'HOLD'
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SignalBadge
                signal={getRSISignal(value)}
                size="small"
                {...props}
            />
            <span style={{ fontSize: '11px', color: '#475569' }}>
                RSI: {value}
            </span>
        </div>
    )
}

export const TrendBadge = ({ trend, ...props }) => {
    const trendSignals = {
        'bullish': 'BUY',
        'bearish': 'SELL',
        'sideways': 'HOLD'
    }

    return (
        <SignalBadge
            signal={trendSignals[trend] || 'HOLD'}
            size="small"
            {...props}
        />
    )
}
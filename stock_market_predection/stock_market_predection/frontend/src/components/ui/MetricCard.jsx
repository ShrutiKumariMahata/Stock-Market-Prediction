import { useState, useEffect } from 'react'

export default function MetricCard({
    label,
    value,
    color = '#e2e8f0',
    sub,
    icon,
    trend,
    trendValue,
    isLoading = false,
    onClick,
    tooltip,
    size = 'medium',
    variant = 'default', // default, success, warning, danger, info
    animate = false
}) {
    const [displayValue, setDisplayValue] = useState(0)
    const [isAnimating, setIsAnimating] = useState(false)

    // Animate value changes
    useEffect(() => {
        if (animate && typeof value === 'number') {
            setIsAnimating(true)
            const duration = 1000
            const steps = 30
            const increment = (value - displayValue) / steps
            let currentStep = 0

            const timer = setInterval(() => {
                currentStep++
                setDisplayValue(prev => {
                    const next = prev + increment
                    return currentStep >= steps ? value : next
                })

                if (currentStep >= steps) {
                    clearInterval(timer)
                    setIsAnimating(false)
                }
            }, duration / steps)

            return () => clearInterval(timer)
        } else {
            setDisplayValue(value)
        }
    }, [value, animate])

    // Size configurations
    const sizeConfig = {
        small: {
            padding: '10px 12px',
            labelSize: '10px',
            valueSize: '16px',
            subSize: '10px',
            iconSize: '16px'
        },
        medium: {
            padding: '14px 16px',
            labelSize: '11px',
            valueSize: '22px',
            subSize: '11px',
            iconSize: '20px'
        },
        large: {
            padding: '18px 20px',
            labelSize: '12px',
            valueSize: '28px',
            subSize: '12px',
            iconSize: '24px'
        }
    }

    // Variant styles
    const variantStyles = {
        default: {
            border: '#1e293b',
            background: '#0f1117',
            labelColor: '#475569',
            iconBg: '#1e293b'
        },
        success: {
            border: '#22c55e33',
            background: '#22c55e11',
            labelColor: '#22c55e88',
            iconBg: '#22c55e22'
        },
        warning: {
            border: '#eab30833',
            background: '#eab30811',
            labelColor: '#eab30888',
            iconBg: '#eab30822'
        },
        danger: {
            border: '#ef444433',
            background: '#ef444411',
            labelColor: '#ef444488',
            iconBg: '#ef444422'
        },
        info: {
            border: '#3b82f633',
            background: '#3b82f611',
            labelColor: '#3b82f688',
            iconBg: '#3b82f622'
        }
    }

    const config = sizeConfig[size]
    const currentVariant = variantStyles[variant] || variantStyles.default

    // Trend arrow component
    const TrendIndicator = () => {
        if (!trend) return null

        const trendConfig = {
            up: { arrow: '↑', color: '#22c55e' },
            down: { arrow: '↓', color: '#ef4444' },
            stable: { arrow: '→', color: '#eab308' },
            positive: { arrow: '▲', color: '#22c55e' },
            negative: { arrow: '▼', color: '#ef4444' },
            neutral: { arrow: '◆', color: '#475569' }
        }

        const trendStyle = trendConfig[trend] || trendConfig.neutral

        return (
            <span style={{
                color: trendStyle.color,
                fontSize: config.subSize,
                marginLeft: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
            }}>
                <span style={{ fontSize: config.valueSize * 0.6 }}>
                    {trendStyle.arrow}
                </span>
                {trendValue && (
                    <span style={{ fontWeight: 'bold' }}>
                        {trendValue}
                    </span>
                )}
            </span>
        )
    }

    // Loading skeleton
    if (isLoading) {
        return (
            <div style={{
                background: currentVariant.background,
                border: `0.5px solid ${currentVariant.border}`,
                borderRadius: '10px',
                padding: config.padding,
                animation: 'pulse 1.5s ease-in-out infinite'
            }}>
                <div style={{
                    width: '60%',
                    height: config.labelSize,
                    background: '#1e293b',
                    borderRadius: '3px',
                    marginBottom: '8px'
                }} />
                <div style={{
                    width: '80%',
                    height: config.valueSize,
                    background: '#1e293b',
                    borderRadius: '4px',
                    marginBottom: '4px'
                }} />
                {sub && (
                    <div style={{
                        width: '40%',
                        height: config.subSize,
                        background: '#1e293b',
                        borderRadius: '3px'
                    }} />
                )}
            </div>
        )
    }

    // Format value based on type
    const formatValue = (val) => {
        if (typeof val === 'number') {
            // Check if it's a percentage
            if (label?.toLowerCase().includes('%') || label?.toLowerCase().includes('percent')) {
                return `${val.toFixed(2)}%`
            }
            // Check if it's a large number
            if (Math.abs(val) >= 1000000000) {
                return `$${(val / 1000000000).toFixed(2)}B`
            }
            if (Math.abs(val) >= 1000000) {
                return `$${(val / 1000000).toFixed(2)}M`
            }
            if (Math.abs(val) >= 1000) {
                return `$${(val / 1000).toFixed(2)}K`
            }
            // Regular price
            if (label?.toLowerCase().includes('price')) {
                return `$${val.toFixed(2)}`
            }
            return val.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        }
        return val || '—'
    }

    return (
        <div
            style={{
                background: currentVariant.background,
                border: `0.5px solid ${currentVariant.border}`,
                borderRadius: '10px',
                padding: config.padding,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                ...(onClick && {
                    ':hover': {
                        border: `0.5px solid ${color}44`,
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 12px ${color}11`
                    }
                })
            }}
            onClick={onClick}
            title={tooltip}
        >
            {/* Background decoration */}
            {icon && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    right: '8px',
                    transform: 'translateY(-50%)',
                    fontSize: config.iconSize * 2,
                    opacity: 0.05,
                    pointerEvents: 'none',
                    userSelect: 'none'
                }}>
                    {icon}
                </div>
            )}

            {/* Header with icon */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px'
            }}>
                {icon && (
                    <div style={{
                        width: config.iconSize,
                        height: config.iconSize,
                        borderRadius: '6px',
                        background: currentVariant.iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: config.iconSize * 0.6
                    }}>
                        {icon}
                    </div>
                )}
                <div style={{
                    fontSize: config.labelSize,
                    color: currentVariant.labelColor,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '500'
                }}>
                    {label}
                </div>
            </div>

            {/* Value */}
            <div style={{
                fontSize: config.valueSize,
                fontWeight: '700',
                color,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                lineHeight: '1.2',
                transition: 'all 0.3s ease',
                transform: isAnimating ? 'scale(1.05)' : 'scale(1)'
            }}>
                {typeof displayValue === 'number' ? formatValue(displayValue) : displayValue}
                <TrendIndicator />
            </div>

            {/* Subtitle */}
            {sub && (
                <div style={{
                    fontSize: config.subSize,
                    color: '#475569',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    {sub}
                </div>
            )}

            {/* Progress bar (optional) */}
            {typeof value === 'number' && typeof sub === 'number' && (
                <div style={{
                    marginTop: '8px',
                    height: '2px',
                    background: '#1e293b',
                    borderRadius: '1px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        height: '100%',
                        width: `${Math.min(100, (value / sub) * 100)}%`,
                        background: color,
                        borderRadius: '1px',
                        transition: 'width 0.5s ease'
                    }} />
                </div>
            )}
        </div>
    )
}

// ==================== Preset Variants ====================

export const PriceCard = (props) => (
    <MetricCard
        {...props}
        icon="💰"
        variant="info"
    />
)

export const ChangeCard = ({ change, ...props }) => (
    <MetricCard
        {...props}
        color={change > 0 ? '#22c55e' : change < 0 ? '#ef4444' : '#eab308'}
        trend={change > 0 ? 'up' : change < 0 ? 'down' : 'stable'}
        variant={change > 0 ? 'success' : change < 0 ? 'danger' : 'warning'}
    />
)

export const AccuracyCard = (props) => (
    <MetricCard
        {...props}
        icon="🎯"
        variant="success"
    />
)

export const RiskCard = (props) => (
    <MetricCard
        {...props}
        icon="⚠️"
        variant="warning"
    />
)

export const VolumeCard = (props) => (
    <MetricCard
        {...props}
        icon="📊"
        variant="info"
    />
)

export const LoadingCard = (props) => (
    <MetricCard
        {...props}
        isLoading={true}
    />
)
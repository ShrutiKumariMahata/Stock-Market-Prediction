import { useEffect, useRef, useState, useCallback } from 'react'

export default function Terminal({
    lines = [],
    isLoading = false,
    maxLines = 500,
    height = 280,
    showHeader = true,
    onClear,
    title = 'QuantAI Training Console'
}) {
    const ref = useRef(null)
    const [autoScroll, setAutoScroll] = useState(true)
    const [filter, setFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [paused, setPaused] = useState(false)
    const [stats, setStats] = useState({
        total: 0,
        errors: 0,
        warnings: 0,
        checkpoints: 0,
        epochs: 0
    })

    // Process lines and update stats
    useEffect(() => {
        const newStats = {
            total: lines.length,
            errors: lines.filter(l => l.type === 'error').length,
            warnings: lines.filter(l => l.type === 'warning').length,
            checkpoints: lines.filter(l => l.type === 'checkpoint').length,
            epochs: lines.filter(l => l.type === 'epoch').length
        }
        setStats(newStats)
    }, [lines])

    // Auto-scroll to bottom (only if user hasn't scrolled up)
    useEffect(() => {
        if (ref.current && autoScroll && !paused) {
            ref.current.scrollTop = ref.current.scrollHeight
        }
    }, [lines, autoScroll, paused])

    // Detect manual scroll
    const handleScroll = useCallback(() => {
        if (ref.current) {
            const { scrollTop, scrollHeight, clientHeight } = ref.current
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
            setAutoScroll(isAtBottom)
        }
    }, [])

    // Message type configurations
    const messageTypes = {
        init: {
            color: '#22d3ee',
            icon: '⚙️',
            label: 'System',
            prefix: 'ℹ'
        },
        epoch: {
            color: '#e2e8f0',
            icon: '🔄',
            label: 'Training',
            prefix: '▶'
        },
        checkpoint: {
            color: '#22c55e',
            icon: '💾',
            label: 'Save',
            prefix: '✓'
        },
        lr_step: {
            color: '#fbbf24',
            icon: '📊',
            label: 'Scheduler',
            prefix: '⚡'
        },
        done: {
            color: '#22c55e',
            icon: '✅',
            label: 'Complete',
            prefix: '✔'
        },
        error: {
            color: '#ef4444',
            icon: '❌',
            label: 'Error',
            prefix: '✗'
        },
        warning: {
            color: '#eab308',
            icon: '⚠️',
            label: 'Warning',
            prefix: '!'
        },
        data: {
            color: '#8b5cf6',
            icon: '📦',
            label: 'Data',
            prefix: '◆'
        },
        info: {
            color: '#64748b',
            icon: '📝',
            label: 'Info',
            prefix: '●'
        }
    }

    const getMessageConfig = (type) => {
        return messageTypes[type] || {
            color: '#94a3b8',
            icon: '●',
            label: type || 'Log',
            prefix: '○'
        }
    }

    // Filter lines based on current filter and search
    const filteredLines = lines.filter(line => {
        // Type filter
        if (filter !== 'all' && line.type !== filter) return false

        // Search filter
        if (searchTerm && !line.text.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false
        }

        return true
    })

    // Apply max lines limit
    const displayLines = filteredLines.slice(-maxLines)

    // Format timestamp
    const formatTime = (timestamp) => {
        if (!timestamp) {
            const now = new Date()
            return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
        }
        return timestamp
    }

    // Handle copy all
    const handleCopyAll = () => {
        const text = lines.map(l => `[${formatTime(l.time)}] ${l.text}`).join('\n')
        navigator.clipboard.writeText(text)
    }

    // Handle export
    const handleExport = () => {
        const text = lines.map(l => `[${formatTime(l.time)}] [${l.type}] ${l.text}`).join('\n')
        const blob = new Blob([text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `training_log_${new Date().toISOString().split('T')[0]}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div style={{
            background: '#080b10',
            border: '0.5px solid #1e293b',
            borderRadius: '10px',
            overflow: 'hidden'
        }}>
            {/* Header */}
            {showHeader && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    background: '#0f1117',
                    borderBottom: '0.5px solid #1e293b',
                    flexWrap: 'wrap',
                    gap: '8px'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '4px'
                        }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: '#ef4444',
                                cursor: 'pointer'
                            }} />
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: '#eab308',
                                cursor: 'pointer'
                            }} />
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: '#22c55e',
                                cursor: 'pointer'
                            }} />
                        </div>
                        <span style={{
                            color: '#64748b',
                            fontSize: '11px',
                            fontWeight: '500'
                        }}>
                            {title}
                        </span>
                        {isLoading && (
                            <span style={{
                                color: '#22d3ee',
                                fontSize: '10px',
                                animation: 'pulse 1.5s ease-in-out infinite'
                            }}>
                                ● Running...
                            </span>
                        )}
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}>
                        {/* Stats */}
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            fontSize: '10px',
                            color: '#475569'
                        }}>
                            <span title="Total messages">📋 {stats.total}</span>
                            {stats.errors > 0 && (
                                <span title="Errors" style={{ color: '#ef4444' }}>
                                    ✗ {stats.errors}
                                </span>
                            )}
                            {stats.checkpoints > 0 && (
                                <span title="Checkpoints" style={{ color: '#22c55e' }}>
                                    💾 {stats.checkpoints}
                                </span>
                            )}
                        </div>

                        {/* Controls */}
                        <div style={{
                            display: 'flex',
                            gap: '4px'
                        }}>
                            <button
                                onClick={() => setPaused(!paused)}
                                style={{
                                    background: paused ? '#22c55e22' : '#1e293b',
                                    border: 'none',
                                    color: paused ? '#22c55e' : '#475569',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    fontFamily: 'monospace'
                                }}
                                title={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
                            >
                                {paused ? '▶' : '⏸'}
                            </button>
                            <button
                                onClick={handleCopyAll}
                                style={{
                                    background: '#1e293b',
                                    border: 'none',
                                    color: '#475569',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    fontFamily: 'monospace'
                                }}
                                title="Copy all to clipboard"
                            >
                                📋
                            </button>
                            <button
                                onClick={handleExport}
                                style={{
                                    background: '#1e293b',
                                    border: 'none',
                                    color: '#475569',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    fontFamily: 'monospace'
                                }}
                                title="Export as .txt"
                            >
                                💾
                            </button>
                            {onClear && (
                                <button
                                    onClick={onClear}
                                    style={{
                                        background: '#1e293b',
                                        border: 'none',
                                        color: '#ef4444',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontFamily: 'monospace'
                                    }}
                                    title="Clear terminal"
                                >
                                    🗑
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Filter Bar */}
            {lines.length > 10 && (
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    padding: '4px 8px',
                    background: '#0a0d12',
                    borderBottom: '0.5px solid #1e293b',
                    flexWrap: 'wrap'
                }}>
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1,
                            minWidth: '100px',
                            background: '#0f1117',
                            border: '0.5px solid #1e293b',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            color: '#e2e8f0',
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            outline: 'none'
                        }}
                    />
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{
                            background: '#0f1117',
                            border: '0.5px solid #1e293b',
                            borderRadius: '4px',
                            padding: '2px 4px',
                            color: '#e2e8f0',
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="all">All</option>
                        <option value="epoch">Epochs</option>
                        <option value="checkpoint">Checkpoints</option>
                        <option value="error">Errors</option>
                        <option value="warning">Warnings</option>
                        <option value="init">System</option>
                    </select>
                </div>
            )}

            {/* Terminal Content */}
            <div
                ref={ref}
                onScroll={handleScroll}
                style={{
                    padding: '14px 16px',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    fontSize: '12px',
                    lineHeight: '1.8',
                    height: height,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    wordBreak: 'break-word'
                }}
            >
                {/* Welcome message */}
                {lines.length === 0 && (
                    <div style={{ color: '#334155' }}>
                        <div style={{ marginBottom: '8px' }}>
                            ╔══════════════════════════════════════╗
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            ║  {title} v2.1             ║
                        </div>
                        <div style={{ marginBottom: '4px' }}>
                            ║  Type "help" for commands           ║
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                            ╚══════════════════════════════════════╝
                        </div>
                        <div style={{ color: '#22d3ee' }}>
                            $ Press <span style={{ color: '#22c55e' }}>Start Training</span> to begin...
                        </div>
                    </div>
                )}

                {/* Display lines */}
                {displayLines.map((line, i) => {
                    const config = getMessageConfig(line.type)
                    const isNew = i === displayLines.length - 1 && lines.length > 0

                    return (
                        <div
                            key={`${line.time}-${i}`}
                            style={{
                                color: config.color,
                                opacity: isNew ? 1 : 0.9,
                                transition: 'opacity 0.3s ease',
                                paddingLeft: line.type === 'error' || line.type === 'warning' ? '0' : '0',
                                borderLeft: line.type === 'error' ? '2px solid #ef4444' :
                                    line.type === 'warning' ? '2px solid #eab308' : 'none',
                                padding: line.type === 'error' || line.type === 'warning' ? '2px 8px' : '0',
                                marginBottom: line.type === 'error' || line.type === 'warning' ? '4px' : '0',
                                background: line.type === 'error' ? '#ef444408' :
                                    line.type === 'warning' ? '#eab30808' : 'transparent'
                            }}
                        >
                            <span style={{ color: '#334155', marginRight: '8px' }}>
                                [{formatTime(line.time)}]
                            </span>
                            <span style={{
                                color: config.color,
                                marginRight: '6px',
                                fontSize: '10px'
                            }}>
                                {config.icon}
                            </span>
                            <span style={{
                                color: '#475569',
                                marginRight: '6px',
                                fontSize: '9px',
                                textTransform: 'uppercase'
                            }}>
                                [{config.label}]
                            </span>
                            {line.text}
                        </div>
                    )
                })}

                {/* Line count indicator */}
                {filteredLines.length > displayLines.length && (
                    <div style={{
                        color: '#475569',
                        fontSize: '10px',
                        textAlign: 'center',
                        padding: '4px',
                        marginTop: '4px',
                        borderTop: '0.5px solid #1e293b'
                    }}>
                        Showing last {maxLines} of {filteredLines.length} lines
                        {searchTerm && ` (filtered by "${searchTerm}")`}
                    </div>
                )}

                {/* Auto-scroll indicator */}
                {!autoScroll && !paused && (
                    <button
                        onClick={() => setAutoScroll(true)}
                        style={{
                            position: 'sticky',
                            bottom: '8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#22d3ee22',
                            border: '0.5px solid #22d3ee44',
                            color: '#22d3ee',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontFamily: 'monospace'
                        }}
                    >
                        ↓ Scroll to bottom
                    </button>
                )}
            </div>
        </div>
    )
}
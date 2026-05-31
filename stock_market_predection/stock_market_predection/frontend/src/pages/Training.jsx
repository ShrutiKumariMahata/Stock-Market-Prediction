import { useState, useRef, useCallback, useEffect } from 'react'
import Terminal from '../components/ui/Terminal'
import LossChart from '../components/charts/LossChart'
import AccuracyChart from '../components/charts/AccuracyChart'
import MetricCard from '../components/ui/MetricCard'
import { startTrainingStream, getTrainingStatus, stopTraining as apiStopTraining } from '../services/api'

const card = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
}

// Style for metric cards (boxes)
const metricCardStyle = {
    background: '#ffffff',
    border: '1px solid #2563eb',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.1)',
    transition: 'all 0.2s ease'
}

function ts() {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

const TICKERS = [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'GOOGL', name: 'Google' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'AMZN', name: 'Amazon' },
    { symbol: 'NVDA', name: 'NVIDIA' },
]

const MODEL_TYPES = [
    { value: 'lstm_attention', label: 'LSTM + Attention' },
    { value: 'cnn_lstm', label: 'CNN-LSTM Hybrid' },
    { value: 'transformer', label: 'Transformer' },
]

const selectStyle = {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none'
}

const inputStyle = {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none'
}

export default function Training() {
    const [running, setRunning] = useState(false)
    const [lines, setLines] = useState([])
    const [lossData, setLossData] = useState([])
    const [accData, setAccData] = useState([])
    const [current, setCurrent] = useState(null)
    const [epochPct, setEpochPct] = useState(0)
    const [bestMetrics, setBestMetrics] = useState(null)
    const [trainingTime, setTrainingTime] = useState(0)
    const [earlyStopped, setEarlyStopped] = useState(false)

    const [config, setConfig] = useState({
        ticker: 'AAPL',
        epochs: 50,
        batchSize: 32,
        learningRate: 0.001,
        modelType: 'lstm_attention',
        sequenceLength: 60
    })

    const esRef = useRef(null)
    const startTimeRef = useRef(null)
    const timerRef = useRef(null)

    useEffect(() => {
        if (running) {
            startTimeRef.current = Date.now()
            timerRef.current = setInterval(() => {
                setTrainingTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
            }, 1000)
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [running])

    const addLine = useCallback((type, text) => {
        setLines(prev => [...prev.slice(-100), { type, text, time: ts() }])
    }, [])

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    }

    const startTraining = useCallback(() => {
        if (running) return

        setRunning(true)
        setLines([])
        setLossData([])
        setAccData([])
        setCurrent(null)
        setEpochPct(0)
        setBestMetrics(null)
        setEarlyStopped(false)
        setTrainingTime(0)

        addLine('init', `Starting training for ${config.ticker}`)
        addLine('init', `Model: ${MODEL_TYPES.find(m => m.value === config.modelType)?.label}`)
        addLine('init', `Epochs: ${config.epochs} | Batch: ${config.batchSize} | LR: ${config.learningRate}`)

        esRef.current = startTrainingStream(
            config,
            (data) => {
                switch (data.type) {
                    case 'init':
                        addLine('init', data.message)
                        break

                    case 'epoch':
                        addLine('epoch',
                            `Epoch ${data.epoch}/${data.total} · loss=${data.train_loss?.toFixed(4)} val_loss=${data.val_loss?.toFixed(4)} acc=${data.direction_accuracy?.toFixed(1)}% lr=${data.lr}`
                        )
                        setLossData(prev => [...prev, {
                            epoch: data.epoch,
                            train_loss: data.train_loss,
                            val_loss: data.val_loss
                        }])
                        setAccData(prev => [...prev, {
                            epoch: data.epoch,
                            accuracy: data.direction_accuracy
                        }])
                        setCurrent(data)
                        setEpochPct(Math.round((data.epoch / data.total) * 100))

                        if (data.is_best) {
                            setBestMetrics({
                                epoch: data.epoch,
                                trainLoss: data.train_loss,
                                valLoss: data.val_loss,
                                accuracy: data.direction_accuracy
                            })
                        }
                        break

                    case 'checkpoint':
                        addLine('checkpoint', data.message)
                        break

                    case 'lr_step':
                        addLine('lr_step', data.message)
                        break

                    case 'early_stopping':
                        addLine('init', data.message)
                        setEarlyStopped(true)
                        break

                    case 'completed':
                        addLine('done', data.message)
                        addLine('done', `Best val_loss: ${data.best_val_loss}`)
                        addLine('done', `Final accuracy: ${data.final_accuracy}%`)
                        addLine('done', `Total time: ${formatTime(trainingTime)}`)
                        setRunning(false)
                        break

                    case 'error':
                        addLine('error', data.message)
                        setRunning(false)
                        break

                    case 'stopped':
                        addLine('init', data.message)
                        setRunning(false)
                        break

                    default:
                        addLine('info', JSON.stringify(data))
                }
            },
            (error) => {
                addLine('error', `Connection error: ${error}`)
                setRunning(false)
            }
        )
    }, [running, config, addLine, trainingTime])

    const stopTraining = useCallback(() => {
        if (esRef.current) {
            esRef.current.close()
        }
        apiStopTraining().catch(console.error)
        setRunning(false)
        addLine('init', 'Training stopped by user.')
    }, [addLine])

    useEffect(() => {
        return () => {
            if (esRef.current) {
                esRef.current.close()
            }
        }
    }, [])

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                        Model Training Console
                    </h1>
                    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                        {running ? (
                            <span style={{ color: '#22c55e' }}>● Training in progress · {formatTime(trainingTime)}</span>
                        ) : earlyStopped ? (
                            <span style={{ color: '#f59e0b' }}>Training completed (early stopping)</span>
                        ) : bestMetrics ? (
                            <span style={{ color: '#22c55e' }}>Training completed</span>
                        ) : (
                            'Configure and start model training'
                        )}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={startTraining}
                        disabled={running}
                        style={{
                            background: running ? '#cbd5e1' : '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            padding: '10px 24px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            cursor: running ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: running ? 0.6 : 1
                        }}
                    >
                        {running ? 'Training...' : 'Start Training'}
                    </button>
                    <button
                        onClick={stopTraining}
                        disabled={!running}
                        style={{
                            background: 'transparent',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            cursor: !running ? 'not-allowed' : 'pointer',
                            opacity: running ? 1 : 0.4,
                            fontWeight: '500'
                        }}
                    >
                        Stop
                    </button>
                </div>
            </div>

            {/* Configuration Panel */}
            {!running && !bestMetrics && (
                <div style={{
                    ...card,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px'
                }}>
                    <div>
                        <label style={{ color: '#475569', fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Stock Ticker</label>
                        <select
                            value={config.ticker}
                            onChange={e => setConfig(prev => ({ ...prev, ticker: e.target.value }))}
                            style={selectStyle}
                        >
                            {TICKERS.map(t => (
                                <option key={t.symbol} value={t.symbol}>{t.symbol} - {t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ color: '#475569', fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Model Type</label>
                        <select
                            value={config.modelType}
                            onChange={e => setConfig(prev => ({ ...prev, modelType: e.target.value }))}
                            style={selectStyle}
                        >
                            {MODEL_TYPES.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ color: '#475569', fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Epochs</label>
                        <input
                            type="number"
                            value={config.epochs}
                            onChange={e => setConfig(prev => ({ ...prev, epochs: parseInt(e.target.value) || 50 }))}
                            min={10}
                            max={200}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={{ color: '#475569', fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Batch Size</label>
                        <input
                            type="number"
                            value={config.batchSize}
                            onChange={e => setConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 32 }))}
                            min={8}
                            max={128}
                            style={inputStyle}
                        />
                    </div>
                </div>
            )}

            {/* Training Complete Summary */}
            {bestMetrics && !running && (
                <div style={{
                    ...card,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0'
                }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#22c55e', marginBottom: '12px' }}>
                        Training Complete
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                        <div>
                            <div style={{ color: '#64748b', fontSize: '10px' }}>Best Epoch</div>
                            <div style={{ color: '#1e293b', fontSize: '18px', fontWeight: '600' }}>{bestMetrics.epoch}</div>
                        </div>
                        <div>
                            <div style={{ color: '#64748b', fontSize: '10px' }}>Best Val Loss</div>
                            <div style={{ color: '#22c55e', fontSize: '18px', fontWeight: '600', fontFamily: 'monospace' }}>
                                {bestMetrics.valLoss?.toFixed(6)}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: '#64748b', fontSize: '10px' }}>Best Accuracy</div>
                            <div style={{ color: '#2563eb', fontSize: '18px', fontWeight: '600' }}>
                                {bestMetrics.accuracy?.toFixed(2)}%
                            </div>
                        </div>
                        <div>
                            <div style={{ color: '#64748b', fontSize: '10px' }}>Total Time</div>
                            <div style={{ color: '#1e293b', fontSize: '18px', fontWeight: '600' }}>
                                {formatTime(trainingTime)}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setBestMetrics(null)
                            setLossData([])
                            setAccData([])
                            setLines([])
                            setCurrent(null)
                            setEpochPct(0)
                        }}
                        style={{
                            marginTop: '12px',
                            background: '#dcfce7',
                            border: '1px solid #bbf7d0',
                            color: '#22c55e',
                            padding: '6px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Train Again
                    </button>
                </div>
            )}

            {/* Metrics Cards - White boxes with blue borders */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                {/* Epoch Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>EPOCH</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>
                        {current ? `${current.epoch} / ${current.total}` : '— / —'}
                    </div>
                </div>

                {/* Train Loss Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>TRAIN LOSS</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                        {current ? current.train_loss?.toFixed(4) : '—'}
                    </div>
                </div>

                {/* Val Loss Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>VAL LOSS</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#f97316' }}>
                        {current ? current.val_loss?.toFixed(4) : '—'}
                    </div>
                </div>

                {/* Direction Acc Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>DIRECTION ACC</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
                        {current ? `${current.direction_accuracy?.toFixed(1)}%` : '—'}
                    </div>
                </div>

                {/* Learning Rate Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>LEARNING RATE</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                        {current ? current.lr : '1e-3'}
                    </div>
                </div>

                {/* Progress Card */}
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#64748b', marginBottom: '4px' }}>PROGRESS</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563eb' }}>
                        {epochPct}%
                    </div>
                    {running && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{formatTime(trainingTime)}</div>}
                </div>
            </div>

            {/* Progress Bar */}
            <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {running ? 'Training Progress' : bestMetrics ? 'Training Complete' : 'Ready'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                        {epochPct}%
                    </span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${epochPct}%`,
                        background: running ? 'linear-gradient(90deg, #2563eb, #60a5fa)' : '#22c55e',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                        position: 'relative'
                    }}>
                        {running && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '20px',
                                background: 'rgba(255,255,255,0.3)',
                                borderRadius: '4px',
                                animation: 'shimmer 1s ease-in-out infinite'
                            }} />
                        )}
                    </div>
                </div>
                {current && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '6px',
                        fontSize: '10px',
                        color: '#94a3b8'
                    }}>
                        <span>Epoch {current.epoch} of {current.total}</span>
                        {current.is_best && <span style={{ color: '#22c55e' }}>● Best model saved</span>}
                    </div>
                )}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
                <div style={card}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '12px' }}>
                        Training Loss vs Validation Loss
                    </div>
                    <LossChart data={lossData} isLoading={running && lossData.length === 0} />
                </div>
                <div style={card}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '12px' }}>
                        Directional Accuracy
                    </div>
                    <AccuracyChart data={accData} isLoading={running && accData.length === 0} />
                </div>
            </div>

            {/* Terminal */}
            <div style={card}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '12px' }}>
                    Training Terminal
                </div>
                <Terminal
                    lines={lines}
                    isLoading={running}
                    height={300}
                    onClear={() => setLines([])}
                />
            </div>
        </div>
    )
}
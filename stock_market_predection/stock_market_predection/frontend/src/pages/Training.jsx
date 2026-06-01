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

const metricCardStyle = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
    outline: 'none',
    boxSizing: 'border-box'
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

    // FIX: learningRate default changed from 0.001 → 0.0003 to match the fixed backend default.
    // The old value was causing val loss spikes in epochs 1-3 → early stopping at ~18 epochs.
    const [config, setConfig] = useState({
        ticker: 'AAPL',
        epochs: 50,
        batchSize: 32,
        learningRate: 0.0003,
        modelType: 'lstm_attention',
        sequenceLength: 60,
        forceFullEpochs: false
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
            if (timerRef.current) clearInterval(timerRef.current)
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
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
        addLine('init', `Model: LSTM + Attention`)
        addLine('init', `Epochs: ${config.epochs} | Batch: ${config.batchSize} | LR: ${config.learningRate}`)
        if (config.forceFullEpochs) {
            addLine('init', 'Early stopping DISABLED — running all epochs')
        }

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
        if (esRef.current) esRef.current.close()
        apiStopTraining().catch(console.error)
        setRunning(false)
        addLine('init', 'Training stopped by user.')
    }, [addLine])

    useEffect(() => {
        return () => { if (esRef.current) esRef.current.close() }
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
                            opacity: running ? 0.6 : 1
                        }}
                    >
                        {running ? 'Training...' : bestMetrics ? 'Train Again' : 'Start Training'}
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
            {!running && (
                <div style={{
                    ...card,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
                            min={10} max={200}
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={{ color: '#475569', fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Batch Size</label>
                        <input
                            type="number"
                            value={config.batchSize}
                            onChange={e => setConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 32 }))}
                            min={8} max={128}
                            style={inputStyle}
                        />
                    </div>

                    {/* FIX: learning rate input was missing from the UI entirely.
                        The hardcoded default of 0.001 in state was always sent to the API,
                        overriding the 0.0003 fix in train.py. Now user can see and change it. */}
                    <div>
                        <label style={{ color: '#475569', fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                            Learning Rate
                        </label>
                        <select
                            value={config.learningRate}
                            onChange={e => setConfig(prev => ({ ...prev, learningRate: parseFloat(e.target.value) }))}
                            style={selectStyle}
                        >
                            <option value={0.0001}>0.0001 (conservative)</option>
                            <option value={0.0003}>0.0003 (recommended)</option>
                            <option value={0.001}>0.001 (aggressive)</option>
                        </select>
                    </div>

                    {/* Force full epochs toggle */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <label style={{ color: '#475569', fontSize: '11px', display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                            Early Stopping
                        </label>
                        <div
                            onClick={() => setConfig(prev => ({ ...prev, forceFullEpochs: !prev.forceFullEpochs }))}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                cursor: 'pointer',
                                background: config.forceFullEpochs ? '#fef9c3' : '#f0fdf4',
                                userSelect: 'none'
                            }}
                        >
                            <div style={{
                                width: '32px', height: '18px',
                                background: config.forceFullEpochs ? '#94a3b8' : '#22c55e',
                                borderRadius: '9px',
                                position: 'relative',
                                transition: 'background 0.2s',
                                flexShrink: 0
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: config.forceFullEpochs ? '2px' : '14px',
                                    width: '14px', height: '14px',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    transition: 'left 0.2s'
                                }} />
                            </div>
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                                {config.forceFullEpochs ? 'Disabled' : 'Enabled'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Training Complete Summary */}
            {bestMetrics && !running && (
                <div style={{ ...card, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
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
                            <div style={{ color: '#1e293b', fontSize: '18px', fontWeight: '600' }}>{formatTime(trainingTime)}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>EPOCH</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                        {current ? `${current.epoch} / ${current.total}` : '— / —'}
                    </div>
                </div>
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>TRAIN LOSS</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                        {current ? current.train_loss?.toFixed(4) : '—'}
                    </div>
                </div>
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>VAL LOSS</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                        {current ? current.val_loss?.toFixed(4) : '—'}
                    </div>
                </div>
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>DIRECTION ACC</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                        {current ? `${current.direction_accuracy?.toFixed(1)}%` : '—'}
                    </div>
                </div>
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>LEARNING RATE</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', fontFamily: 'monospace' }}>
                        {current ? current.lr : config.learningRate}
                    </div>
                </div>
                <div style={metricCardStyle}>
                    <div style={{ fontSize: '10px', fontWeight: '500', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>PROGRESS</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>{epochPct}%</div>
                    {running && <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>{formatTime(trainingTime)}</div>}
                </div>
            </div>

            {/* Progress Bar */}
            <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {running ? 'Training Progress' : bestMetrics ? 'Training Complete' : 'Ready'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{epochPct}%</span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: `${epochPct}%`,
                        background: running ? 'linear-gradient(90deg, #2563eb, #60a5fa)' : '#22c55e',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
                {current && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#94a3b8' }}>
                        <span>Epoch {current.epoch} of {current.total}</span>
                        {current.is_best && <span style={{ color: '#22c55e' }}>● Best model saved</span>}
                        {!config.forceFullEpochs && current.patience >= 0 && (
                            <span style={{ color: current.patience > 10 ? '#f59e0b' : '#94a3b8' }}>
                                Patience: {current.patience}/{15}
                            </span>
                        )}
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